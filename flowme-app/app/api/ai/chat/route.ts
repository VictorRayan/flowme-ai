import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';
import { buildNowSystemPrompt } from '@/lib/ai/calendar-skill';
import { buildNotesGraphMap } from '@/lib/ai/notes-skill';
import { routeBalysRequest } from '@/lib/ai/shadow-router';
import { ALL_TOOLS, getActiveToolDomains } from '@/lib/ai/tools/registry';
import { runBalysAgentLoopWithFallbacks } from '@/lib/ai/agent-fallback';
import { buildBalysSystemPrompt } from '@/lib/ai/balys-prompt';
import { scoreThreadContext } from '@/lib/ai/context-scorer';
import { prepareMessagesWithAttachments, extractLatestUserText } from '@/lib/ai/prepare-messages';
import { loadProfile, renderProfileForPrompt, callProfileUpdater, persistProfile } from '@/lib/ai/memory/profile';
import { loadTopFacts, renderFactsForPrompt, touchFacts } from '@/lib/ai/memory/facts';
import { summarizeAndPersistThread, SUMMARIZE_EVERY_N_USER_TURNS } from '@/lib/ai/memory/recall';
import { ensureThread, persistMessage, type ThreadAttachmentMeta } from '@/lib/ai/threads';
import { hasRecentConnectorContext, inferRecentConnectorType, renderConnectorContextForPrompt } from '@/lib/ai/connector-context';

const PROFILE_UPDATE_EVERY_N_USER_TURNS = 12;
type ConnectorIntent = {
  id?: string;
  label?: string;
  action?: 'gmail' | 'drive' | 'docs' | 'sheets' | 'briefing' | 'note' | 'weather' | 'council';
};

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

function computeAgentMaxSteps(route: ReturnType<typeof routeBalysRequest>, connectorIntent: ConnectorIntent | null): number {
  const routedBudget = route.gates?.maxAutoToolCalls || 5;
  if (connectorIntent?.action === 'gmail') return Math.max(routedBudget, 18);
  if (connectorIntent?.action === 'docs' || connectorIntent?.action === 'sheets' || connectorIntent?.action === 'drive') {
    return Math.max(routedBudget, 24);
  }
  if (route.needsTools) return Math.max(routedBudget, 16);
  return routedBudget;
}

function isBroadListRequest(text: string): boolean {
  return /\b(list|show|what.*(here|have)|which|recent)\b/i.test(text)
    || /\b(lista|listar|mostra|mostrar|quais|que.*(tem|tenho)|o que chegou|caixa de entrada|recentes?)\b/i.test(text);
}

function isReadFollowUp(text: string): boolean {
  return /\b(read|open|what.*in|content|body|summari[sz]e|explain)\b/i.test(text)
    || /\b(ler|leia|abre|abrir|conte[uú]do|corpo|o que tem|resume|resumir|explica|analisa|analisar)\b/i.test(text);
}

function requiredFirstToolForConnector(
  route: ReturnType<typeof routeBalysRequest>,
  connectorIntent: ConnectorIntent | null,
  latestText: string,
  messages: any[],
): string | undefined {
  const action = connectorIntent?.action;
  if (action === 'gmail') {
    if (isReadFollowUp(latestText) && hasRecentConnectorContext(messages, (item) => item.tool === 'gmail.search_messages')) {
      return undefined;
    }
    return 'gmail.search_messages';
  }
  if (action === 'docs') {
    if (isReadFollowUp(latestText) && inferRecentConnectorType(messages) === 'google_docs') return 'connectors.find_and_read_doc';
    return isBroadListRequest(latestText) ? 'connectors.search_docs' : 'connectors.find_and_read_doc';
  }
  if (action === 'sheets') {
    if ((isReadFollowUp(latestText) || /\b(mostra|mostrar|ver|veja)\b/i.test(latestText)) && inferRecentConnectorType(messages) === 'google_sheets') {
      return 'connectors.sheets_agent';
    }
    return isBroadListRequest(latestText) ? 'connectors.search_docs' : 'connectors.sheets_agent';
  }
  if (action === 'drive') {
    if (isReadFollowUp(latestText) && inferRecentConnectorType(messages) === 'google_drive') return 'connectors.read_drive_file';
    return 'connectors.search_docs';
  }
  if (!action && isReadFollowUp(latestText)) {
    const recentType = inferRecentConnectorType(messages);
    if (recentType === 'google_sheets') return 'connectors.sheets_agent';
    if (recentType === 'google_docs') return 'connectors.find_and_read_doc';
    if (recentType === 'google_drive') return 'connectors.read_drive_file';
  }
  if (route.toolDomain === 'gmail' && isReadFollowUp(latestText) && hasRecentConnectorContext(messages, (item) => item.tool === 'gmail.search_messages')) {
    return undefined;
  }
  return undefined;
}

function preferredConnectorType(connectorIntent: ConnectorIntent | null, messages?: any[]): 'gmail' | 'google_drive' | 'google_docs' | 'google_sheets' | undefined {
  if (connectorIntent?.action === 'gmail') return 'gmail';
  if (connectorIntent?.action === 'docs') return 'google_docs';
  if (connectorIntent?.action === 'sheets') return 'google_sheets';
  if (connectorIntent?.action === 'drive') return 'google_drive';
  if (messages) return inferRecentConnectorType(messages);
  return undefined;
}

function userSafeLoopErrorMessage(error: any): string {
  const raw = error?.message || String(error);
  if (/429|rate limit|quota|insufficient_quota/i.test(raw)) {
    return 'Balys encontrou um limite temporário do provedor de IA. Tenta de novo em instantes.';
  }
  if (/503|unavailable|overloaded/i.test(raw)) {
    return 'Balys conseguiu acessar a ferramenta, mas o provedor de IA ficou indisponível na hora de montar a resposta. Tenta de novo em instantes.';
  }
  if (/401|incorrect api key|unauthorized/i.test(raw)) {
    return 'Balys encontrou um problema de configuração do provedor de IA.';
  }
  return 'Tive um problema interno ao concluir a resposta. Tenta de novo em instantes.';
}

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
      connectorIntent,
      userLocation,
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

    const [notesMap, userProfile, topFacts, contextScores] = await Promise.all([
      buildNotesGraphMap(auth),
      loadProfile(auth.supabase, auth.user.id),
      aiSettings.memory_enabled ? loadTopFacts(auth.supabase, auth.user.id) : Promise.resolve([]),
      // Context scorer: reads the thread and returns LLM-derived complexity scores.
      // Runs in parallel, times out at 4s, returns null on failure — never blocks routing.
      scoreThreadContext(preparedMessages),
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
      contextScores: contextScores ?? undefined,
    });

    const parsedConnectorIntent: ConnectorIntent | null = connectorIntent && typeof connectorIntent === 'object'
      ? connectorIntent
      : null;
    const connectorMemoryPrompt = renderConnectorContextForPrompt(messages);
    const connectorIntentPrompt = parsedConnectorIntent?.action
      ? [
          `Structured command intent: ${parsedConnectorIntent.label || parsedConnectorIntent.action}.`,
          'Treat this as deterministic metadata selected by the user, not as optional decoration.',
          parsedConnectorIntent.action === 'gmail'
            ? 'Use Gmail tools. SHORT-CIRCUIT: if asked to read or show the content of an email, immediately call gmail.read_message using the message_id from the history or natural sender/subject fields. Do not call gmail.search_messages first if the email was already listed.'
            : '',
          parsedConnectorIntent.action === 'docs'
            ? 'Use Google Docs connector tools. SHORT-CIRCUIT: if the user asks what files are here, call connectors.search_docs immediately and list them. Use connectors.find_and_read_doc to read a named document.'
            : '',
          parsedConnectorIntent.action === 'sheets'
            ? 'Use Google Sheets connector tools. SHORT-CIRCUIT: if asked to list sheets, call connectors.search_docs immediately. Read or analyze actual spreadsheet content before giving insights.'
            : '',
          parsedConnectorIntent.action === 'drive'
            ? 'Use Google Drive connector tools. SHORT-CIRCUIT: if asked what files are here, call connectors.search_docs immediately. Discover files before selecting and reading the relevant file.'
            : '',
        ].filter(Boolean).join(' ')
      : '';
    const effectiveSystemAddendum = [typeof systemAddendum === 'string' ? systemAddendum : '', connectorIntentPrompt, connectorMemoryPrompt].filter(s => s.trim()).join('\n\n');

    const systemPromptFull = buildBalysSystemPrompt({
      nowSection: buildNowSystemPrompt({
        timezone: typeof timezone === 'string' ? timezone : undefined,
        clientNowIso: typeof clientNowIso === 'string' ? clientNowIso : undefined,
      }),
      language: typeof language === 'string' ? language : undefined,
      systemAddendum: effectiveSystemAddendum || undefined,
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
        let finalTarget: { provider: string; model: string } = skillTarget;
        const thinkingForPersistence: any[] = [];
        const rawThreadIdHeader = request.headers.get('x-thread-id');
        const threadIdForTools = rawThreadIdHeader || 'default-thread';
        // Only persist when we have a real thread id (UUID-shaped) and the user is authenticated.
        const isRealThreadId = Boolean(rawThreadIdHeader && /^[0-9a-fA-F-]{16,}$/.test(rawThreadIdHeader));

        try {
          let toolCallObserved = false;
          const latestTextForTools = typeof rawUserInput === 'string' ? rawUserInput : transcribedUserText;
          const requiredFirstTool = requiredFirstToolForConnector(route, parsedConnectorIntent, latestTextForTools, messages);
          const preExecuteFirstTool = Boolean(
            requiredFirstTool
            && ['gmail.search_messages', 'connectors.search_docs'].includes(requiredFirstTool)
            && isBroadListRequest(latestTextForTools)
          );
          const fallbackResult = await runBalysAgentLoopWithFallbacks(
            {
              messages: [{ role: 'system', content: systemPromptFull }, ...loopMessages],
              tools: ALL_TOOLS,
              maxSteps: computeAgentMaxSteps(route, parsedConnectorIntent),
              requiredFirstTool,
              preExecuteFirstTool,
              provider: skillTarget.provider,
              model: skillTarget.model,
              context: {
                supabase: auth.supabase,
                user: auth.user,
                nowIso: typeof clientNowIso === 'string' ? clientNowIso : new Date().toISOString(),
                timezone: typeof timezone === 'string' ? timezone : 'UTC',
                threadId: threadIdForTools,
                preferredConnectorType: preferredConnectorType(parsedConnectorIntent, messages),
                userLocation: userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lon === 'number'
                  ? { lat: userLocation.lat, lon: userLocation.lon, name: userLocation.name }
                  : undefined,
              },
              threadId: threadIdForTools,
              onProgress: (event) => {
                if (event.type === 'tool_call_start' || event.type === 'tool_call_end') {
                  toolCallObserved = true;
                }
                if (event.type === 'tool_call_start') {
                  thinkingForPersistence.push({
                    call_id: event.call_id,
                    tool: event.tool,
                    args: event.args,
                    status: 'running',
                  });
                }
                if (event.type === 'tool_call_end') {
                  const idx = thinkingForPersistence.findIndex((step) => step.call_id === event.call_id);
                  const update = {
                    call_id: event.call_id,
                    tool: event.tool,
                    status: event.ok ? 'ok' : 'failed',
                    receipt: event.receipt,
                    error: event.error,
                  };
                  if (idx >= 0) thinkingForPersistence[idx] = { ...thinkingForPersistence[idx], ...update };
                  else thinkingForPersistence.push(update);
                }
                send(event);
              },
            },
            route.fallbacks,
            (attempt) => {
              const errMsg = attempt.error instanceof Error ? attempt.error.message : String(attempt.error);
              const next = attempt.nextTarget
                ? toolCallObserved
                  ? '; not retrying because a tool call already started'
                  : `; retrying ${attempt.nextTarget.provider}:${attempt.nextTarget.model}`
                : '; no fallback remains';
              console.warn(`[balys-debug] Agent loop attempt failed for ${attempt.target.provider}:${attempt.target.model}: ${errMsg}${next}`);
            },
            () => !toolCallObserved,
          );
          const loopResult = fallbackResult.result;
          finalTarget = fallbackResult.target;

          console.log('[balys-debug] Agent loop completed. Steps:', loopResult.steps, '| Has content:', !!loopResult.content, '| model:', `${finalTarget.provider}:${finalTarget.model}`);

          const finalText = loopResult.content && loopResult.content.trim()
            ? loopResult.content
            : requiredFirstTool
              ? 'Tive um problema ao acessar essa conexão agora. Tenta de novo em instantes.'
              : 'I finished but had nothing to add. If you expected an answer, try rephrasing.';
          assistantFinalText = finalText;
          send({ type: 'text', text: finalText });
          send({ type: 'done' });
        } catch (loopError: any) {
          console.error('[balys-debug] Agent loop FAILED:', loopError);
          const errMsg = userSafeLoopErrorMessage(loopError);
          send({ type: 'error', message: errMsg });
          send({ type: 'text', text: errMsg });
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
            const threadMeta = {
              id: rawThreadIdHeader!,
              title: typeof (messages?.[0]?.content) === 'string'
                ? (messages[0].content as string).trim().slice(0, 80) || 'New chat'
                : 'New chat',
              provider: finalTarget.provider,
              model: finalTarget.model,
              tier: route.tier,
              route_label: route.userFacingLabel,
              execution_plan: route.executionPlan,
            };

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
                selected_action: lastIncoming.selectedAction || parsedConnectorIntent || undefined,
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
              thinking: thinkingForPersistence.length > 0 ? thinkingForPersistence : undefined,
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
