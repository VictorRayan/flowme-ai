import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';
import OpenAI from 'openai';
import { estimateTokensFromText, logAiUsage } from '@/lib/ai/billing';
import { buildNowSystemPrompt, tryRunCalendarSkill } from '@/lib/ai/calendar-skill';
import { buildNotesGraphMap, tryRunNotesSkill } from '@/lib/ai/notes-skill';
import { routeBalysRequest } from '@/lib/ai/shadow-router';
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

interface AuthCtx {
  supabase: any;
  user: any;
}

type Provider = 'openai' | 'gemini';

type RoutedTarget = {
  provider: Provider;
  model: string;
};

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, ' ').trim();
}

function buildRouteHeaders(route: ReturnType<typeof routeBalysRequest>, target: RoutedTarget): Record<string, string> {
  return {
    'X-Balys-Router': 'shadow-antigravity',
    'X-Balys-Tier': route.tier,
    'X-Balys-Provider': target.provider,
    'X-Balys-Model': target.model,
    'X-Balys-Execution-Plan': route.executionPlan,
    'X-Balys-Route-Label': sanitizeHeaderValue(route.userFacingLabel),
  };
}

function dedupeTargets(targets: RoutedTarget[]): RoutedTarget[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = `${target.provider}:${target.model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    const {
      messages,
      language,
      systemAddendum,
      timezone,
      clientNowIso,
      rawUserInput,
    } = await request.json();
    if (!messages?.length) return NextResponse.json({ error: 'Messages are required' }, { status: 400 });

    const langMap: Record<string, string> = {
      en: 'English', pt: 'Portuguese', es: 'Spanish', fr: 'French',
      de: 'German', it: 'Italian', ja: 'Japanese', zh: 'Chinese',
    };

    const notesMap = await buildNotesGraphMap(auth);

    const notesIntent = await tryRunNotesSkill({
      auth,
      messages: messages.map((m: IncomingMessage) => ({
        role: m.role,
        content: m.content || '',
      })),
      provider: 'openai',
      notesMap
    });

    if (notesIntent?.type === 'return_to_user') {
      const dummyRoute = routeBalysRequest({ messages, rawUserInput: typeof rawUserInput === 'string' ? rawUserInput : undefined });
      return new Response(notesIntent.text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          ...buildRouteHeaders(dummyRoute, dummyRoute.executor),
        },
      });
    }

    const parts = [
      buildNowSystemPrompt({
        timezone: typeof timezone === 'string' ? timezone : undefined,
        clientNowIso: typeof clientNowIso === 'string' ? clientNowIso : undefined,
      }),
      // HARD GUARDRAIL — must come early so it is never overridden
      `CRITICAL RULES — you must never break these:
1. You CANNOT create, edit, delete, or modify calendar events. Those actions are handled exclusively by the calendar skill layer before you run. If the skill ran, its result was already returned to the user — do not repeat or rephrase it.
2. You MUST NOT claim, imply, or suggest that you created, updated, or deleted any calendar event unless you are reading a confirmed receipt that was injected into this conversation by the skill layer (receipts start with "✓ Event").
3. If a user asks you to do something with their calendar and the skill did not handle it (you have no receipt), respond with: "I wasn't able to execute that calendar action directly. Please rephrase your request or include more details (event name, date, time)."
4. Never fabricate event IDs, Google links, or Meet links.`,
      language ? `Always respond in ${langMap[language] || language}.` : '',
      systemAddendum || '',
      notesMap || '',
      notesIntent?.type === 'inject_context' ? notesIntent.text : ''
    ].filter(Boolean);
    const systemPromptFull = parts.join('\n\n');
    const route = routeBalysRequest({
      messages,
      rawUserInput: typeof rawUserInput === 'string' ? rawUserInput : undefined,
      systemAddendum: typeof systemAddendum === 'string' ? systemAddendum : undefined,
    });
    const routingMetadata: Record<string, unknown> = {
      ...route.telemetryTags,
      primary_provider: route.primary.provider,
      primary_model: route.primary.model,
      planner_provider: route.planner.provider,
      planner_model: route.planner.model,
      executor_provider: route.executor.provider,
      executor_model: route.executor.model,
      verifier_provider: route.verifier.provider,
      verifier_model: route.verifier.model,
      shadow_provider: route.shadow?.provider || '',
      shadow_model: route.shadow?.model || '',
      overall_score: route.overallScore,
      score_ambiguity: route.scores.ambiguity,
      score_reasoning: route.scores.reasoning,
      score_workflow_length: route.scores.workflowLength,
      score_risk: route.scores.risk,
    };

    const skillTarget = route.executionPlan === 'direct_tool' ? route.executor : route.planner;
    const skillResult = await tryRunCalendarSkill({
      auth,
      messages: messages.map((m: IncomingMessage) => ({
        role: m.role,
        content: m.content || '',
      })),
      provider: skillTarget.provider,
      model: skillTarget.model,
      timezone: typeof timezone === 'string' ? timezone : undefined,
      clientNowIso: typeof clientNowIso === 'string' ? clientNowIso : undefined,
    });
    if (skillResult) {
      return new Response(skillResult, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          ...buildRouteHeaders(route, skillTarget),
        },
      });
    }

    const attempts = dedupeTargets([route.primary, ...route.fallbacks.map((fallback) => fallback.target)]);
    let lastError: unknown = null;

    for (let index = 0; index < attempts.length; index += 1) {
      const target = attempts[index];
      const metadata = {
        ...routingMetadata,
        route_attempt: index + 1,
        route_provider: target.provider,
        route_model: target.model,
        route_role:
          target.provider === route.planner.provider && target.model === route.planner.model
            ? 'planner'
            : target.provider === route.executor.provider && target.model === route.executor.model
              ? 'executor'
              : target.provider === route.verifier.provider && target.model === route.verifier.model
                ? 'verifier'
                : 'fallback',
      };

      try {
        if (target.provider === 'gemini') {
          return await handleGemini(auth, messages, target.model, systemPromptFull, metadata, buildRouteHeaders(route, target));
        }
        return await handleOpenAI(auth, messages, target.model, systemPromptFull, metadata, buildRouteHeaders(route, target));
      } catch (attemptError) {
        lastError = attemptError;
        console.warn(`[shadow-router] attempt ${index + 1} failed for ${target.provider}:${target.model}`, attemptError);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('All routed providers failed');
  } catch (err: unknown) {
    let msg = err instanceof Error ? err.message : String(err);
    if (msg === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    if (msg.includes('429') || msg.includes('Rate limit') || msg.includes('quota')) {
      msg = 'Balys hit a temporary provider rate limit. The router will retry automatically on the next request.';
    } else if (msg.includes('401') || msg.includes('Incorrect API key')) {
      msg = 'One of the Balys provider API keys is invalid or unauthorized. Check OPENAI_API_KEY and GEMINI_API_KEY in .env.local.';
    } else if (msg.includes('insufficient_quota')) {
      msg = 'A provider quota was exceeded. Check your OpenAI and Gemini billing settings.';
    }
    return apiError(ErrorCode.INTERNAL_ERROR, msg);
  }
}

async function handleOpenAI(
  auth: AuthCtx,
  messages: IncomingMessage[],
  model: string,
  systemPrompt = '',
  routingMetadata: Record<string, unknown> = {},
  responseHeaders: Record<string, string> = {},
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

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

  const selectedModel = model || 'gpt-4o';
  const isO1 = selectedModel.startsWith('o1') || selectedModel.startsWith('o3');

  if (isO1) {
    const completion = await openai.chat.completions.create({ model: selectedModel, messages: builtMessages, stream: false });
    const text = completion.choices[0]?.message?.content || '';
    const promptTokens = completion.usage?.prompt_tokens ?? estimateTokensFromText(JSON.stringify(builtMessages));
    const completionTokens = completion.usage?.completion_tokens ?? estimateTokensFromText(text);

    await logAiUsage({
      supabase: auth.supabase,
      user: auth.user,
      feature: 'chat',
      provider: 'openai',
      model: selectedModel,
      promptTokens,
      completionTokens,
      metadata: { ...routingMetadata, usage_source: completion.usage ? 'api' : 'estimated' },
    });

    return new Response(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        ...responseHeaders,
      },
    });
  }

  const completion = await openai.chat.completions.create({
    model: selectedModel,
    messages: builtMessages,
    stream: true,
    stream_options: { include_usage: true },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let output = '';
      let usagePrompt = 0;
      let usageCompletion = 0;
      let hasUsage = false;

      for await (const chunk of completion) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
          output += text;
          controller.enqueue(encoder.encode(text));
        }

        const usage = (chunk as any).usage;
        if (usage) {
          hasUsage = true;
          usagePrompt = usage.prompt_tokens ?? usagePrompt;
          usageCompletion = usage.completion_tokens ?? usageCompletion;
        }
      }

      const promptTokens = hasUsage ? usagePrompt : estimateTokensFromText(JSON.stringify(builtMessages));
      const completionTokens = hasUsage ? usageCompletion : estimateTokensFromText(output);

      await logAiUsage({
        supabase: auth.supabase,
        user: auth.user,
        feature: 'chat',
        provider: 'openai',
        model: selectedModel,
        promptTokens,
        completionTokens,
        metadata: { ...routingMetadata, usage_source: hasUsage ? 'api' : 'estimated' },
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...responseHeaders,
    },
  });
}

async function handleGemini(
  auth: AuthCtx,
  messages: IncomingMessage[],
  model: string,
  systemPrompt = '',
  routingMetadata: Record<string, unknown> = {},
  responseHeaders: Record<string, string> = {},
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');

  const modelId = model || 'gemini-2.5-flash';

  const contents = messages.map(msg => {
    const parts: { text?: string; inline_data?: { mime_type: string; data: string } }[] = [];

    if (msg.attachments) {
      for (const att of msg.attachments) {
        if (!att.dataUrl) continue;
        const base64 = att.dataUrl.split(',')[1];
        if (!base64) continue;
        parts.push({ inline_data: { mime_type: att.mimeType, data: base64 } });
      }
    }
    if (msg.content) parts.push({ text: msg.content });
    if (parts.length === 0) parts.push({ text: '' });

    return { role: msg.role === 'assistant' ? 'model' : 'user', parts };
  });

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
        friendlyMsg = `Quota exceeded for "${modelId}".${retry}`;
      } else if (code === 404) {
        friendlyMsg = `Model "${modelId}" is not available with your API key.`;
      } else if (code === 401 || code === 403) {
        friendlyMsg = 'Invalid or unauthorized Gemini API key. Check GEMINI_API_KEY in .env.local.';
      } else {
        friendlyMsg = errJson?.error?.message || errText;
      }
    } catch { friendlyMsg = errText; }
    throw new Error(friendlyMsg);
  }

  const encoder = new TextEncoder();
  const reader = geminiRes.body!.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = '';
      let output = '';
      let promptTokens = 0;
      let completionTokens = 0;
      let hasUsage = false;

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
              if (text) {
                output += text;
                controller.enqueue(encoder.encode(text));
              }

              const usage = parsed?.usageMetadata;
              if (usage) {
                hasUsage = true;
                promptTokens = usage.promptTokenCount ?? promptTokens;
                completionTokens = usage.candidatesTokenCount ?? completionTokens;
              }
            } catch {
              // ignore malformed SSE chunks
            }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
      }

      const finalPromptTokens = hasUsage ? promptTokens : estimateTokensFromText(JSON.stringify(contents) + systemPrompt);
      const finalCompletionTokens = hasUsage ? completionTokens : estimateTokensFromText(output);

      await logAiUsage({
        supabase: auth.supabase,
        user: auth.user,
        feature: 'chat',
        provider: 'gemini',
        model: modelId,
        promptTokens: finalPromptTokens,
        completionTokens: finalCompletionTokens,
        metadata: { ...routingMetadata, usage_source: hasUsage ? 'api' : 'estimated' },
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...responseHeaders,
    },
  });
}
