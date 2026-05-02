import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';
import { buildNowSystemPrompt } from '@/lib/ai/calendar-skill';
import { buildNotesGraphMap } from '@/lib/ai/notes-skill';
import { routeBalysRequest } from '@/lib/ai/shadow-router';
import { ALL_TOOLS, getActiveToolDomains } from '@/lib/ai/tools/registry';
import { runBalysAgentLoop } from '@/lib/ai/agent-loop';
import { buildBalysSystemPrompt } from '@/lib/ai/balys-prompt';
import { prepareMessagesWithAttachments, extractLatestUserText } from '@/lib/ai/prepare-messages';
import { loadProfile, renderProfileForPrompt, callProfileUpdater, persistProfile } from '@/lib/ai/memory/profile';
import { loadTopFacts, renderFactsForPrompt, touchFacts } from '@/lib/ai/memory/facts';
import { summarizeAndPersistThread, SUMMARIZE_EVERY_N_USER_TURNS } from '@/lib/ai/memory/recall';
import { ensureThread, persistMessage, type ThreadAttachmentMeta } from '@/lib/ai/threads';

const PROFILE_UPDATE_EVERY_N_USER_TURNS = 12;

async function loadUserAiSettings(supabase: any, userId: string): Promise<{ council_mode: 'cheap' | 'best'; memory_enabled: boolean }> {
  try {
    const { data } = await supabase
      .from('user_settings')
      .select('council_mode, memory_enabled')
      .eq('user_id', userId)
      .maybeSingle();
    return {
      council_mode: (data?.council_mode as 'cheap' | 'best') || 'cheap',
      memory_enabled: data?.memory_enabled ?? true,
    };
  } catch {
    return { council_mode: 'cheap', memory_enabled: true };
  }
}

type Provider = 'openai' | 'gemini';

type RoutedTarget = {
  provider: Provider;
  model: string;
};

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, ' ').trim();
}

function encodeHeaderUtf8(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64');
}

function buildRouteHeaders(
  route: ReturnType<typeof routeBalysRequest>,
  target: RoutedTarget,
  extras?: { transcript?: string },
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Balys-Router': 'shadow-antigravity',
    'X-Balys-Tier': route.tier,
    'X-Balys-Provider': target.provider,
    'X-Balys-Model': target.model,
    'X-Balys-Execution-Plan': route.executionPlan,
    'X-Balys-Route-Label': sanitizeHeaderValue(route.userFacingLabel),
  };
  if (extras?.transcript) {
    headers['X-Balys-Transcript'] = encodeHeaderUtf8(extras.transcript);
    headers['X-Balys-Transcript-Encoding'] = 'base64-utf8';
  }
  return headers;
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

    const preparedMessages = await prepareMessagesWithAttachments(messages);
    const transcribedUserText = extractLatestUserText(preparedMessages);

    const latestAudioTranscript = (() => {
      const originalLast = messages[messages.length - 1];
      const preparedLast = preparedMessages[preparedMessages.length - 1];
      if (!originalLast || originalLast.role !== 'user') return '';
      const hadAudio = (originalLast.attachments || []).some((a: any) => a?.type === 'audio');
      if (!hadAudio) return '';
      const before = (originalLast.content || '').trim();
      const after = (preparedLast?.content || '').trim();
      if (!after) return '';
      if (before && after.startsWith(before)) {
        return after.slice(before.length).trim();
      }
      return after;
    })();

    const aiSettings = await loadUserAiSettings(auth.supabase, auth.user.id);

    const [notesMap, userProfile, topFacts] = await Promise.all([
      buildNotesGraphMap(auth),
      loadProfile(auth.supabase, auth.user.id),
      aiSettings.memory_enabled ? loadTopFacts(auth.supabase, auth.user.id) : Promise.resolve([]),
    ]);
    const profileBlock = renderProfileForPrompt(userProfile);
    const factsBlock = aiSettings.memory_enabled ? renderFactsForPrompt(topFacts) : '';

    if (topFacts.length > 0) {
      void touchFacts(auth.supabase, auth.user.id, topFacts.map((f) => f.id));
    }

    const route = routeBalysRequest({
      messages: preparedMessages,
      rawUserInput: typeof rawUserInput === 'string' && rawUserInput.trim() ? rawUserInput : transcribedUserText,
      systemAddendum: typeof systemAddendum === 'string' ? systemAddendum : undefined,
    });

    const systemPromptFull = buildBalysSystemPrompt({
      nowSection: buildNowSystemPrompt({
        timezone: typeof timezone === 'string' ? timezone : undefined,
        clientNowIso: typeof clientNowIso === 'string' ? clientNowIso : undefined,
      }),
      language: typeof language === 'string' ? language : undefined,
      systemAddendum: typeof systemAddendum === 'string' ? systemAddendum : undefined,
      notesMap: typeof notesMap === 'string' ? notesMap : undefined,
      toolsAvailable: getActiveToolDomains(),
      factsBlock,
      profileBlock,
    });

    const skillTarget = route.executionPlan === 'direct_tool' ? route.executor : route.planner;

    console.log('[balys-debug] taskType:', route.taskType, '| tier:', route.tier, '| tools:', ALL_TOOLS.length, '| model:', `${skillTarget.provider}:${skillTarget.model}`);

    const loopMessages = preparedMessages.map((m) => {
      const imageAttachments = (m.attachments || []).filter((a) => a?.type === 'image' && a.dataUrl);
      if (m.role === 'user' && imageAttachments.length > 0) {
        const parts: any[] = imageAttachments.map((a) => ({
          type: 'image_url',
          image_url: { url: a.dataUrl },
        }));
        if (m.content) parts.push({ type: 'text', text: m.content });
        return { role: m.role, content: parts };
      }
      return { role: m.role, content: m.content || '' };
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: any) => {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); } catch {}
        };

        let assistantFinalText = '';
        const rawThreadIdHeader = request.headers.get('x-thread-id');
        const threadIdForTools = rawThreadIdHeader || 'default-thread';
        // Only persist when we have a real thread id (UUID-shaped) and the user is authenticated.
        const isRealThreadId = Boolean(rawThreadIdHeader && /^[0-9a-fA-F-]{16,}$/.test(rawThreadIdHeader));
        const threadMeta = {
          id: isRealThreadId ? rawThreadIdHeader! : undefined,
          title: typeof (messages?.[0]?.content) === 'string'
            ? (messages[0].content as string).trim().slice(0, 80) || 'New chat'
            : 'New chat',
          provider: skillTarget.provider,
          model: skillTarget.model,
          tier: route.tier,
          route_label: route.userFacingLabel,
          execution_plan: route.executionPlan,
        };

        try {
          const loopResult = await runBalysAgentLoop({
            messages: [{ role: 'system', content: systemPromptFull }, ...loopMessages],
            tools: ALL_TOOLS,
            maxSteps: route.gates?.maxAutoToolCalls || 5,
            provider: skillTarget.provider,
            model: skillTarget.model,
            context: {
              supabase: auth.supabase,
              user: auth.user,
              nowIso: typeof clientNowIso === 'string' ? clientNowIso : new Date().toISOString(),
              timezone: typeof timezone === 'string' ? timezone : 'UTC',
              threadId: threadIdForTools,
            },
            threadId: threadIdForTools,
            onProgress: (event) => send(event),
          });

          console.log('[balys-debug] Agent loop completed. Steps:', loopResult.steps, '| Has content:', !!loopResult.content);

          const finalText = loopResult.content && loopResult.content.trim()
            ? loopResult.content
            : 'I finished but had nothing to add. If you expected an answer, try rephrasing.';
          assistantFinalText = finalText;
          send({ type: 'text', text: finalText });
          send({ type: 'done' });
        } catch (loopError: any) {
          console.error('[balys-debug] Agent loop FAILED:', loopError);
          const errMsg = loopError?.message || String(loopError);
          send({ type: 'error', message: errMsg });
          send({ type: 'text', text: `Tive um problema interno: ${errMsg}. Tenta de novo, e se persistir me avisa o que você pediu.` });
          send({ type: 'done' });
        }

        // Tier C: refresh the living user profile every N user turns. Always runs (mandatory).
        // The user already received the response; this is best-effort post-processing.
        try {
          const userTurnsSoFar = preparedMessages.filter((m) => m.role === 'user').length;
          if (userTurnsSoFar > 0 && userTurnsSoFar % PROFILE_UPDATE_EVERY_N_USER_TURNS === 0 && assistantFinalText) {
            const transcriptText = [
              ...preparedMessages.slice(-16).map((m) => `${m.role.toUpperCase()}: ${m.content || ''}`),
              `ASSISTANT: ${assistantFinalText}`,
            ].join('\n\n');
            const result = await callProfileUpdater({ current: userProfile, conversationText: transcriptText });
            if (result.changed) {
              await persistProfile(auth.supabase, auth.user.id, result.updated);
              console.log('[balys-debug] Profile updated. Diff summary:', result.updated.last_updated_summary);
            } else if (result.reason) {
              console.log('[balys-debug] Profile unchanged. Reason:', result.reason);
            }
          }
        } catch (e) {
          console.error('[balys-debug] Profile updater threw:', e);
        }

        // Persist user + assistant message server-side. Best-effort; localStorage stays as a cache.
        try {
          if (isRealThreadId && assistantFinalText) {
            await ensureThread(auth.supabase, auth.user.id, threadMeta);

            const lastIncoming = messages[messages.length - 1];
            if (lastIncoming?.role === 'user') {
              const lastPrepared = preparedMessages[preparedMessages.length - 1];
              const attachmentMeta: ThreadAttachmentMeta[] | undefined = Array.isArray(lastIncoming.attachments)
                ? lastIncoming.attachments
                    .filter((a: any) => a && typeof a.type === 'string' && typeof a.name === 'string')
                    .map((a: any) => ({ type: a.type, name: a.name, mimeType: a.mimeType || '' }))
                : undefined;
              await persistMessage(auth.supabase, auth.user.id, {
                thread_id: threadIdForTools,
                role: 'user',
                content: typeof lastIncoming.content === 'string' ? lastIncoming.content : '',
                attachments: attachmentMeta && attachmentMeta.length > 0 ? attachmentMeta : undefined,
                transcript: latestAudioTranscript || undefined,
              });
              // The prepared (post-transcription) content is what the model actually saw —
              // worth keeping if it differs.
              void lastPrepared;
            }

            await persistMessage(auth.supabase, auth.user.id, {
              thread_id: threadIdForTools,
              role: 'assistant',
              content: assistantFinalText,
            });
          }
        } catch (e) {
          console.error('[balys-debug] persistMessage block threw:', e);
        }

        // Tier B: rolling thread summary every N user turns. Respects memory_enabled.
        try {
          if (aiSettings.memory_enabled && assistantFinalText) {
            const userTurnsSoFar = preparedMessages.filter((m) => m.role === 'user').length;
            if (userTurnsSoFar > 0 && userTurnsSoFar % SUMMARIZE_EVERY_N_USER_TURNS === 0) {
              const messagesForSummary = [
                ...preparedMessages.map((m) => ({ role: m.role, content: m.content || '' })),
                { role: 'assistant' as const, content: assistantFinalText },
              ];
              await summarizeAndPersistThread(
                auth.supabase,
                auth.user.id,
                threadIdForTools,
                messagesForSummary,
              );
              console.log('[balys-debug] Thread summary refreshed for', threadIdForTools);
            }
          }
        } catch (e) {
          console.error('[balys-debug] Thread summarizer threw:', e);
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'X-Balys-Stream-Format': 'sse',
        'Cache-Control': 'no-cache, no-transform',
        ...buildRouteHeaders(route, skillTarget, { transcript: latestAudioTranscript }),
      },
    });
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
