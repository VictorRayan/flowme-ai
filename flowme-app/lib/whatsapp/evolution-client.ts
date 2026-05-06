const EVOLUTION_URL      = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY  = process.env.EVOLUTION_API_KEY!;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME!;

function headers() {
  return { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY };
}

async function post(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${EVOLUTION_URL}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function get(path: string): Promise<any> {
  const res = await fetch(`${EVOLUTION_URL}${path}`, { headers: headers() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

/** Send a plain text message to a WhatsApp JID (e.g. "5511999999999@s.whatsapp.net"). */
/** Send a plain text message. `to` can be a JID or plain E.164 digits — we normalise to digits. */
export async function sendText(to: string, text: string): Promise<void> {
  const number = to.split('@')[0].replace(/\D/g, '');
  await post(`/message/sendText/${EVOLUTION_INSTANCE}`, { number, text });
}

/** Download media for a given message key and return base64 + mimetype. */
export async function downloadMedia(
  messageId: string,
  messageType: string,
): Promise<{ base64: string; mimetype: string }> {
  const data = await post(`/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`, {
    message: { key: { id: messageId } },
    convertToMp4: false,
  });
  return { base64: data.base64 as string, mimetype: data.mimetype as string };
}

/**
 * Send a verification code to a phone number via WhatsApp text.
 * The number must be in E.164 format without the leading +, e.g. "5511999999999".
 */
export async function sendVerificationCode(phone: string, code: string): Promise<void> {
  await sendText(phone, `Your Flowme / Balys verification code is: *${code}*\n\nIt expires in 10 minutes.`);
}

/** Resolve a raw phone number from an Evolution webhook sender JID to E.164 digits only. */
export function jidToPhone(jid: string): string {
  // JID format: "5511999999999@s.whatsapp.net" or "5511999999999@c.us"
  return jid.split('@')[0].replace(/\D/g, '');
}

export { EVOLUTION_INSTANCE };
