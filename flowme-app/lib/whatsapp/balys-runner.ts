import { createClient } from '@supabase/supabase-js';
import { buildBalysSystemPrompt } from '@/lib/ai/balys-prompt';
import { buildNowSystemPrompt } from '@/lib/ai/calendar-skill';
import { buildNotesGraphMap } from '@/lib/ai/notes-skill';
import { routeBalysRequest } from '@/lib/ai/shadow-router';
import { ALL_TOOLS, getActiveToolDomains } from '@/lib/ai/tools/registry';
import { runBalysAgentLoop } from '@/lib/ai/agent-loop';
import { loadProfile, renderProfileForPrompt } from '@/lib/ai/memory/profile';
import { loadTopFacts, renderFactsForPrompt, touchFacts } from '@/lib/ai/memory/facts';
import { ensureThread, persistMessage } from '@/lib/ai/threads';
import { jidToPhone, sendText } from './evolution-client';

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
  return `whatsapp-${userId}-${phone}`;
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

export async function handleWhatsAppMessage(incoming: WhatsAppIncomingMessage): Promise<void> {
  const supabase = makeServiceClient();
  const phone    = jidToPhone(incoming.senderJid);

  const user = await resolveUserByPhone(supabase, phone);
  if (!user) {
    console.log(`[whatsapp-balys] unknown phone ${phone}, ignoring`);
    return;
  }

  const authContext = {
    supabase: supabase as any,
    user: { id: user.id, email: user.email } as any,
  };

  let userText       = incoming.text || '';
  const mediaAttachment = buildMediaAttachment(incoming);

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

  const threadId = threadIdForJid(user.id, incoming.senderJid);
  const nowIso   = new Date().toISOString();

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

  const route = routeBalysRequest({
    messages: [userMessage],
    rawUserInput: userText,
    systemAddendum: WHATSAPP_ADDENDUM,
  });

  const systemPrompt = buildBalysSystemPrompt({
    nowSection: buildNowSystemPrompt({ timezone: 'UTC', clientNowIso: nowIso }),
    systemAddendum: WHATSAPP_ADDENDUM,
    notesMap: typeof notesMap === 'string' ? notesMap : undefined,
    toolsAvailable: getActiveToolDomains(),
    profileBlock,
    factsBlock,
  });

  const skillTarget = route.executionPlan === 'direct_tool' ? route.executor : route.planner;

  // Images go inline as vision content; audio goes through the existing transcription path
  const loopMessages: any[] = [];
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
  try {
    const result = await runBalysAgentLoop({
      messages: [{ role: 'system', content: systemPrompt }, ...loopMessages],
      tools: ALL_TOOLS,
      maxSteps: route.gates?.maxAutoToolCalls || 5,
      provider: skillTarget.provider,
      model: skillTarget.model,
      context: {
        supabase: supabase as any,
        user: authContext.user,
        nowIso,
        timezone: 'UTC',
        threadId,
      },
      threadId,
    });
    replyText = (result.content || '').trim() || 'Done! Let me know if you need anything else.';
  } catch (e: any) {
    console.error('[whatsapp-balys] agent loop failed:', e);
    replyText = 'Sorry, I ran into a problem. Please try again.';
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
    await persistMessage(supabase as any, user.id, { thread_id: threadId, role: 'user',      content: userText });
    await persistMessage(supabase as any, user.id, { thread_id: threadId, role: 'assistant', content: replyText });
  } catch (e) {
    console.error('[whatsapp-balys] persist failed (non-fatal):', e);
  }
}
