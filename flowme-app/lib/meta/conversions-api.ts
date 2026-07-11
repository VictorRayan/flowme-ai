import crypto from 'crypto';

const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

const CAPI_ENDPOINT = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events`;

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export type MetaEventName =
  | 'PageView'
  | 'ViewContent'
  | 'Lead'
  | 'InitiateCheckout'
  | 'AddPaymentInfo'
  | 'Purchase';

export interface MetaEventPayload {
  event_name: MetaEventName;
  event_id: string;
  event_source_url: string;
  external_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  /** Raw _fbp cookie value from the browser */
  fbp?: string;
  /** Raw _fbc cookie value (or built from fbclid) from the browser */
  fbc?: string;
  /** Purchase value in BRL */
  value?: number;
  currency?: string;
}

export async function sendMetaEvent(
  payload: MetaEventPayload,
  ip?: string | null,
  userAgent?: string | null,
): Promise<void> {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[meta/capi] META_PIXEL_ID or META_ACCESS_TOKEN not set — skipping');
    }
    return;
  }

  const user_data: Record<string, string> = {};
  if (payload.external_id) user_data.external_id = sha256(payload.external_id);
  if (payload.name) {
    const parts = payload.name.trim().split(/\s+/).filter(Boolean);
    if (parts[0]) user_data.fn = sha256(parts[0]);
    if (parts.length > 1) user_data.ln = sha256(parts.slice(1).join(' '));
  }
  if (payload.email) user_data.em = sha256(payload.email);
  if (payload.phone) user_data.ph = sha256(payload.phone.replace(/\D/g, ''));
  if (payload.fbp) user_data.fbp = payload.fbp;
  if (payload.fbc) user_data.fbc = payload.fbc;
  if (ip) user_data.client_ip_address = ip;
  if (userAgent) user_data.client_user_agent = userAgent;

  const data: Record<string, unknown>[] = [{
    event_name: payload.event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: payload.event_id,
    event_source_url: payload.event_source_url,
    action_source: 'website',
    user_data,
    ...(payload.value != null ? {
      custom_data: {
        value: payload.value,
        currency: payload.currency ?? 'BRL',
      },
    } : {}),
  }];

  const res = await fetch(`${CAPI_ENDPOINT}?access_token=${ACCESS_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });

  if (!res.ok && process.env.NODE_ENV !== 'production') {
    const body = await res.text();
    console.warn('[meta/capi] CAPI error', res.status, body);
  }
}
