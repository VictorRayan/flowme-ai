import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';
import OpenAI from 'openai';

interface Attachment {
  type: 'image' | 'file' | 'audio';
  name: string;
  dataUrl: string;
  mimeType: string;
}

interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
}

export async function POST(request: NextRequest) {
  await requireAuth(request);

  const { messages, model, provider, language } = await request.json();
  if (!messages?.length) return NextResponse.json({ error: 'Messages are required' }, { status: 400 });

  const langMap: Record<string, string> = {
    en: 'English', pt: 'Portuguese', es: 'Spanish', fr: 'French',
    de: 'German', it: 'Italian', ja: 'Japanese', zh: 'Chinese',
  };
  const systemLanguage = language ? `Always respond in ${langMap[language] || language}.` : '';

  try {
    if (provider === 'gemini') {
      return await handleGemini(messages, model, systemLanguage);
    }
    return await handleOpenAI(messages, model, systemLanguage);
  } catch (err: unknown) {
    let msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429') || msg.includes('Rate limit') || msg.includes('quota')) {
      msg = 'Rate limit reached for this OpenAI model. Wait a moment and try again, or switch to a different model.';
    } else if (msg.includes('401') || msg.includes('Incorrect API key')) {
      msg = 'Invalid OpenAI API key. Check OPENAI_API_KEY in .env.local.';
    } else if (msg.includes('insufficient_quota')) {
      msg = 'OpenAI quota exceeded. Check your billing at platform.openai.com.';
    }
    return apiError(ErrorCode.INTERNAL_ERROR, msg);
  }
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function handleOpenAI(messages: IncomingMessage[], model: string, systemPrompt = '') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 });

  const openai = new OpenAI({ apiKey });

  const builtMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (systemPrompt) builtMessages.push({ role: 'system', content: systemPrompt });

  for (const msg of messages) {
    if (msg.role === 'assistant') {
      builtMessages.push({ role: 'assistant', content: msg.content });
      continue;
    }

    const contentParts: OpenAI.Chat.ChatCompletionContentPart[] = [];

    if (msg.attachments) {
      for (const att of msg.attachments) {
        if (att.type === 'audio') {
          try {
            const base64 = att.dataUrl.split(',')[1];
            const buffer = Buffer.from(base64, 'base64');
            const blob = new Blob([buffer], { type: att.mimeType });
            const file = new File([blob], att.name, { type: att.mimeType });
            const transcription = await openai.audio.transcriptions.create({
              model: 'whisper-1',
              file: file as unknown as Parameters<typeof openai.audio.transcriptions.create>[0]['file'],
            });
            contentParts.push({ type: 'text', text: `[Transcribed audio: "${transcription.text}"]` });
          } catch (e) {
            contentParts.push({ type: 'text', text: `[Audio transcription failed: ${e instanceof Error ? e.message : String(e)}]` });
          }
        } else if (att.type === 'image') {
          contentParts.push({ type: 'image_url', image_url: { url: att.dataUrl } });
        } else if (att.type === 'file') {
          try {
            const base64 = att.dataUrl.split(',')[1];
            const text = Buffer.from(base64, 'base64').toString('utf-8');
            contentParts.push({ type: 'text', text: `[File: ${att.name}]\n${text}` });
          } catch {
            contentParts.push({ type: 'text', text: `[File: ${att.name}]` });
          }
        }
      }
    }

    if (msg.content) contentParts.push({ type: 'text', text: msg.content });

    builtMessages.push({
      role: 'user',
      content: contentParts.length === 1 && contentParts[0].type === 'text'
        ? (contentParts[0] as OpenAI.Chat.ChatCompletionContentPartText).text
        : contentParts,
    });
  }

  const isO1 = model?.startsWith('o1') || model?.startsWith('o3');

  if (isO1) {
    const completion = await openai.chat.completions.create({ model, messages: builtMessages, stream: false });
    const text = completion.choices[0]?.message?.content || '';
    return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const completion = await openai.chat.completions.create({ model: model || 'gpt-4o', messages: builtMessages, stream: true });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of completion) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function handleGemini(messages: IncomingMessage[], model: string, systemPrompt = '') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 400 });

  const modelId = model || 'gemini-2.0-flash';

  // Build Gemini REST contents array
  const contents = messages.map(msg => {
    const parts: { text?: string; inline_data?: { mime_type: string; data: string } }[] = [];

    if (msg.attachments) {
      for (const att of msg.attachments) {
        const base64 = att.dataUrl.split(',')[1];
        parts.push({ inline_data: { mime_type: att.mimeType, data: base64 } });
      }
    }
    if (msg.content) parts.push({ text: msg.content });
    if (parts.length === 0) parts.push({ text: '' });

    return { role: msg.role === 'assistant' ? 'model' : 'user', parts };
  });

  // Use Gemini REST API v1 with streaming
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const body: Record<string, unknown> = { contents };
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };

  const geminiRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    let friendlyMsg = 'Gemini API error';
    try {
      const errJson = JSON.parse(errText);
      const code = errJson?.error?.code;
      const status = errJson?.error?.status;
      if (code === 429 || status === 'RESOURCE_EXHAUSTED') {
        const retryMatch = errText.match(/retry in ([\d.]+)s/);
        const retry = retryMatch ? ` Try again in ${Math.ceil(Number(retryMatch[1]))} seconds.` : '';
        friendlyMsg = `Quota exceeded for "${modelId}" (free tier limit reached).${retry} Switch to Gemini 2.0 Flash or upgrade at ai.dev/rate-limit.`;
      } else if (code === 404) {
        friendlyMsg = `Model "${modelId}" is not available with your API key. Please select a different model.`;
      } else if (code === 401 || code === 403) {
        friendlyMsg = 'Invalid or unauthorized Gemini API key. Check GEMINI_API_KEY in .env.local.';
      } else {
        friendlyMsg = errJson?.error?.message || errText;
      }
    } catch { friendlyMsg = errText; }
    return NextResponse.json({ error: friendlyMsg }, { status: geminiRes.status });
  }

  // Forward SSE stream, extracting text from each chunk
  const encoder = new TextEncoder();
  const reader = geminiRes.body!.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const json = line.slice(6).trim();
            if (!json || json === '[DONE]') continue;
            try {
              const parsed = JSON.parse(json);
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (text) controller.enqueue(encoder.encode(text));
            } catch { /* skip malformed */ }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
