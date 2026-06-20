import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { buildBalysSystemPrompt } from '@/lib/ai/balys-prompt';
import { buildNowSystemPrompt } from '@/lib/ai/calendar-skill';
import { buildNotesGraphMap } from '@/lib/ai/notes-skill';
import { routeBalysRequest } from '@/lib/ai/shadow-router';
import { ALL_TOOLS, getActiveToolDomains } from '@/lib/ai/tools/registry';
import { runBalysAgentLoop } from '@/lib/ai/agent-loop';
import { loadProfile, renderProfileForPrompt } from '@/lib/ai/memory/profile';
import { loadTopFacts, renderFactsForPrompt, touchFacts } from '@/lib/ai/memory/facts';
import { ensureThread, getThreadMessages, persistMessage } from '@/lib/ai/threads';
import { hasRecentConnectorContext, inferRecentConnectorType, renderConnectorContextForPrompt } from '@/lib/ai/connector-context';
import { prepareMessagesWithAttachments } from '@/lib/ai/prepare-messages';
import { jidToPhone, sendText } from './evolution-client';
import { FeatureLockedError, requireFeature } from '@/lib/billing/entitlements';
import { acquireAiUsageGuard, releaseAiUsageGuard, resolveAiGuardWorkload } from '@/lib/billing/ai-guardrails';
import { recordBillingAdminAlert } from '@/lib/billing/admin-alerts';

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function makeServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface WhatsAppIncomingMessage {
  senderJid: string;
  messageId: string;
  messageType: 'conversation' | 'imageMessage' | 'audioMessage' | 'videoMessage' | 'documentMessage' | 'stickerMessage' | 'extendedTextMessage';
  text?: string;
  hasMedia: boolean;
  /** Base64 media payload delivered inline by Evolution when "Webhook Base64" is enabled. */
  mediaBase64?: string;
  mediaMimetype?: string;
  pushName?: string;
}

interface ResolvedUser {
  id: string;
  email: string;
}

async function resolveUserByPhone(
  supabase: ReturnType<typeof makeServiceClient>,
  phone: string,
): Promise<ResolvedUser | null> {
  const { data } = await supabase
    .from('whatsapp_channels')
    .select('user_id')
    .eq('phone', phone)
    .eq('status', 'active')
    .maybeSingle();

  if (!data?.user_id) return null;

  const { data: userData } = await supabase.auth.admin.getUserById(data.user_id);
  if (!userData?.user) return null;

  return { id: userData.user.id, email: userData.user.email ?? '' };
}

function buildMediaAttachment(
  incoming: WhatsAppIncomingMessage,
): { type: 'image' | 'audio'; dataUrl: string; name: string; mimeType: string } | null {
  if (!incoming.mediaBase64 || !incoming.mediaMimetype) return null;

  const dataUrl = `data:${incoming.mediaMimetype};base64,${incoming.mediaBase64}`;

  if (incoming.messageType === 'imageMessage' || incoming.messageType === 'stickerMessage') {
    return { type: 'image', dataUrl, name: 'image.jpg', mimeType: incoming.mediaMimetype };
  }
  if (incoming.messageType === 'audioMessage') {
    return { type: 'audio', dataUrl, name: 'audio.ogg', mimeType: incoming.mediaMimetype };
  }
  return null;
}

function threadIdForJid(userId: string, jid: string): string {
  const phone = jidToPhone(jid);
  const hex = createHash('sha256')
    .update(`whatsapp:${userId}:${phone}`)
    .digest('hex')
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Convert markdown to WhatsApp-safe text. */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, '').trim())
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const WHATSAPP_ADDENDUM = `You are replying via WhatsApp. Keep responses concise and conversational — no markdown headers, no code fences, plain text only. Use *bold* for emphasis if needed (WhatsApp renders it). If the user sends an image or audio, process and respond naturally.`;

function isReadFollowUp(text: string): boolean {
  return /\b(read|open|what.*in|content|body|summari[sz]e|explain)\b/i.test(text)
    || /\b(ler|leia|abre|abrir|conte[uú]do|corpo|o que tem|resume|resumir|explica|analisa|analisar)\b/i.test(text);
}

function isBroadListRequest(text: string): boolean {
  return /\b(list|show|what.*(here|have)|which|recent)\b/i.test(text)
    || /\b(lista|listar|mostra|mostrar|quais|que.*(tem|tenho)|o que chegou|caixa de entrada|recentes?)\b/i.test(text);
}

function requiredFirstToolForWhatsApp(text: string, messages: any[]): string | undefined {
  if (/\b(gmail|email|e-mail|mail|caixa de entrada)\b/i.test(text)) {
    if (isReadFollowUp(text) && hasRecentConnectorContext(messages, (item) => item.tool === 'gmail.search_messages')) {
      return undefined;
    }
    return 'gmail.search_messages';
  }
  if (isReadFollowUp(text)) {
    const recentType = inferRecentConnectorType(messages);
    if (recentType === 'google_sheets') return 'connectors.sheets_agent';
    if (recentType === 'google_docs') return 'connectors.find_and_read_doc';
    if (recentType === 'google_drive') return 'connectors.read_drive_file';
  }
  if (/\b(docs?|documentos?)\b/i.test(text)) return 'connectors.search_docs';
  if (/\b(sheets?|planilhas?)\b/i.test(text)) return 'connectors.search_docs';
  if (/\bdrive|arquivos?\b/i.test(text)) return 'connectors.search_docs';
  return undefined;
}

function preferredConnectorTypeForWhatsApp(text: string, messages: any[], requiredFirstTool?: string) {
  if (/\b(gmail|email|e-mail|mail|caixa de entrada)\b/i.test(text)) return 'gmail';
  if (/\b(docs?|documentos?)\b/i.test(text)) return 'google_docs';
  if (/\b(sheets?|planilhas?)\b/i.test(text)) return 'google_sheets';
  if (/\bdrive|arquivos?\b/i.test(text)) return 'google_drive';
  if (requiredFirstTool?.startsWith('connectors.')) return inferRecentConnectorType(messages);
  return undefined;
}

export async function handleWhatsAppMessage(incoming: WhatsAppIncomingMessage): Promise<void> {
  const supabase = makeServiceClient();
  const phone    = jidToPhone(incoming.senderJid);

  const user = await resolveUserByPhone(supabase, phone);
  if (!user) {
    console.log(`[whatsapp-balys] unknown phone ${phone}, ignoring`);
    return;
  }

  try {
    await requireFeature(supabase, user.id, 'whatsapp');
  } catch (error: unknown) {
    if (error instanceof FeatureLockedError) {
      await sendText(incoming.senderJid, 'O Balys no WhatsApp está disponível no Flow Me Pro. Você pode fazer upgrade nas configurações do app.');
      return;
    }
    throw error;
  }

  const authContext = {
    supabase: supabase as any,
    user: { id: user.id, email: user.email } as any,
  };

  let userText = incoming.text || '';
  let mediaAttachment = buildMediaAttachment(incoming);
  const originalMediaAttachment = mediaAttachment;

  if (incoming.messageType === 'videoMessage') {
    userText = userText || '[Video message — video processing is not supported yet. Describe what you need in text.]';
  }
  if (incoming.messageType === 'documentMessage') {
    userText = userText || '[Document received — document processing via WhatsApp is not yet supported. Try uploading it in the Flowme app.]';
  }
  if (incoming.hasMedia && !mediaAttachment && !userText) {
    // Media arrived but "Webhook Base64" was not enabled — no base64 in payload
    userText = '[Media received but could not be processed. Make sure "Webhook Base64" is enabled in your Evolution instance settings.]';
  }

  if (!userText && !mediaAttachment) {
    await sendText(incoming.senderJid, "Hi! I received your message but couldn't read it. Please try sending text, an image, or a voice note.");
    return;
  }

  if (mediaAttachment?.type === 'audio') {
    const [prepared] = await prepareMessagesWithAttachments([
      { role: 'user', content: userText, attachments: [mediaAttachment] },
    ]);
    userText = prepared?.content?.trim() || '';
    mediaAttachment = null;

    if (!userText || userText.startsWith('[Audio transcription failed:')) {
      console.error('[whatsapp-balys] audio transcription failed:', userText || 'empty transcript');
      await sendText(incoming.senderJid, "I couldn't understand that voice note. Can you try sending it again, or write it as text?");
      return;
    }
  }

  const threadId = threadIdForJid(user.id, incoming.senderJid);
  const nowIso   = new Date().toISOString();
  const persistedHistory = (await getThreadMessages(supabase as any, user.id, threadId).catch(() => []))
    .slice(-18)
    .map((message: any) => ({
      role: message.role,
      content: message.content || '',
      thinking: Array.isArray(message.thinking) ? message.thinking : undefined,
    }));

  const [notesMap, userProfile, topFacts] = await Promise.all([
    buildNotesGraphMap(authContext).catch(() => ''),
    loadProfile(supabase as any, user.id),
    loadTopFacts(supabase as any, user.id),
  ]);

  if (topFacts.length > 0) {
    void touchFacts(supabase as any, user.id, topFacts.map((f) => f.id));
  }

  const profileBlock = renderProfileForPrompt(userProfile);
  const factsBlock   = renderFactsForPrompt(topFacts);

  const userMessage: any = {
    role: 'user',
    content: userText,
    ...(mediaAttachment ? { attachments: [mediaAttachment] } : {}),
  };
  const routeMessages = [...persistedHistory, userMessage];

  const route = routeBalysRequest({
    messages: routeMessages,
    rawUserInput: userText,
    systemAddendum: WHATSAPP_ADDENDUM,
  });
  const guardWorkload = resolveAiGuardWorkload({
    taskType: route.taskType,
    toolDomain: route.toolDomain,
    needsTools: route.needsTools,
  });
  const guard = await acquireAiUsageGuard(supabase, user.id, guardWorkload);
  if (!guard.allowed) {
    await recordBillingAdminAlert(supabase, {
      kind: 'high_ai_cost',
      severity: guard.reason === 'daily' ? 'critical' : 'warning',
      userId: user.id,
      dedupeKey: `ai-guard:${user.id}:${guardWorkload}:${guard.reason}:${new Date().toISOString().slice(0, 13)}`,
      metadata: { workload: guardWorkload, reason: guard.reason, channel: 'whatsapp' },
    });
    await sendText(incoming.senderJid, 'O Balys está protegendo sua conta de muitas ações ao mesmo tempo. Tente novamente em instantes.');
    return;
  }
  const connectorMemoryPrompt = renderConnectorContextForPrompt(routeMessages);
  const effectiveAddendum = [WHATSAPP_ADDENDUM, connectorMemoryPrompt].filter((part) => part.trim()).join('\n\n');

  const systemPrompt = buildBalysSystemPrompt({
    nowSection: buildNowSystemPrompt({ timezone: 'UTC', clientNowIso: nowIso }),
    systemAddendum: effectiveAddendum,
    notesMap: typeof notesMap === 'string' ? notesMap : undefined,
    toolsAvailable: getActiveToolDomains(),
    profileBlock,
    factsBlock,
  });

  const skillTarget = route.executionPlan === 'direct_tool' ? route.executor : route.planner;

  // Images go inline as vision content; audio goes through the existing transcription path
  const loopMessages: any[] = persistedHistory.map((message) => ({ role: message.role, content: message.content }));
  if (mediaAttachment?.type === 'image') {
    loopMessages.push({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: mediaAttachment.dataUrl } },
        ...(userText ? [{ type: 'text', text: userText }] : []),
      ],
    });
  } else {
    loopMessages.push({ role: 'user', content: userText });
  }

  let replyText = '';
  const thinkingForPersistence: any[] = [];
  try {
    const requiredFirstTool = requiredFirstToolForWhatsApp(userText, routeMessages);
    const result = await runBalysAgentLoop({
      messages: [{ role: 'system', content: systemPrompt }, ...loopMessages],
      tools: ALL_TOOLS,
      maxSteps: requiredFirstTool ? Math.max(route.gates?.maxAutoToolCalls || 5, 16) : route.gates?.maxAutoToolCalls || 5,
      requiredFirstTool,
      preExecuteFirstTool: Boolean(
        requiredFirstTool
        && ['gmail.search_messages', 'connectors.search_docs'].includes(requiredFirstTool)
        && isBroadListRequest(userText)
      ),
      provider: skillTarget.provider,
      model: skillTarget.model,
      context: {
        supabase: supabase as any,
        user: authContext.user,
        nowIso,
        timezone: 'UTC',
        threadId,
        preferredConnectorType: preferredConnectorTypeForWhatsApp(userText, routeMessages, requiredFirstTool),
      },
      threadId,
      onProgress: (event) => {
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
      },
    });
    replyText = (result.content || '').trim() || 'Done! Let me know if you need anything else.';
  } catch (e: any) {
    console.error('[whatsapp-balys] agent loop failed:', e);
    replyText = 'Sorry, I ran into a problem. Please try again.';
  } finally {
    await releaseAiUsageGuard(supabase, guard.leaseId).catch(error => console.error('[whatsapp-balys] failed to release AI guard:', error));
  }

  await sendText(incoming.senderJid, stripMarkdown(replyText));

  try {
    await ensureThread(supabase as any, user.id, {
      id: threadId,
      title: 'WhatsApp',
      provider: skillTarget.provider,
      model: skillTarget.model,
      tier: route.tier,
      route_label: route.userFacingLabel,
      execution_plan: route.executionPlan,
    });
    await persistMessage(supabase as any, user.id, {
      thread_id: threadId,
      role: 'user',
      content: userText,
      ...(originalMediaAttachment ? { attachments: [originalMediaAttachment] } : {}),
      ...(originalMediaAttachment?.type === 'audio' ? { transcript: userText } : {}),
    });
    await persistMessage(supabase as any, user.id, {
      thread_id: threadId,
      role: 'assistant',
      content: replyText,
      thinking: thinkingForPersistence.length > 0 ? thinkingForPersistence : undefined,
    });
  } catch (e) {
    console.error('[whatsapp-balys] persist failed (non-fatal):', e);
  }
}
