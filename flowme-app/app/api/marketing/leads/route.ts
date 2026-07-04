import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import {
  ipHash,
  marketingCorsHeaders,
  marketingOptions,
  requestOrigin,
  verifyMarketingCsrfToken,
} from '@/lib/marketing/security';
import { createSignedMarketingToken } from '@/lib/marketing/signed-token';
import { parseInternationalPhone } from '@/lib/whatsapp/phone-number';

const LOCALES = ['pt-BR', 'en-US'] as const;
const BILLING_INTERVALS = ['monthly', 'annual'] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function phoneForLocale(phone: string, locale: typeof LOCALES[number]) {
  if (phone.trim().startsWith('+')) return phone;
  const digits = normalizePhone(phone);
  return locale === 'pt-BR'
    ? `+55${digits.length > 11 ? digits.slice(-11) : digits}`
    : `+1${digits.length > 10 ? digits.slice(-10) : digits}`;
}

export function OPTIONS(req: NextRequest) {
  return marketingOptions(req);
}

export async function POST(req: NextRequest) {
  const origin = requestOrigin(req);
  const headers = marketingCorsHeaders(origin);
  const token = req.headers.get('x-flowme-csrf') || '';
  if (!verifyMarketingCsrfToken(token, origin)) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid marketing token' } }, { status: 403, headers });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const locale = LOCALES.includes(body.locale as typeof LOCALES[number]) ? body.locale as typeof LOCALES[number] : null;
  const name = text(body.name, 160);
  const email = text(body.email, 240).toLowerCase();
  const phone = text(body.phone, 40);
  const billingInterval = BILLING_INTERVALS.includes(body.interval as typeof BILLING_INTERVALS[number])
    ? body.interval as typeof BILLING_INTERVALS[number]
    : 'annual';
  const digits = normalizePhone(phone);
  const path = text(body.path, 300);
  const parsedPhone = locale ? parseInternationalPhone(phoneForLocale(phone, locale)) : null;
  if (!locale || name.length < 2 || !EMAIL_RE.test(email) || digits.length < 10 || !parsedPhone || !path) {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Name, email, phone and path are required' } }, { status: 400, headers });
  }

  const bodyMetadata = typeof body.metadata === 'object' && body.metadata !== null && !Array.isArray(body.metadata) ? body.metadata : {};
  const metadata = { ...bodyMetadata, billing_interval: billingInterval };
  const { data, error } = await getSupabaseAdmin().from('marketing_leads').insert({
    visitor_id: text(body.visitor_id, 120),
    session_id: text(body.session_id, 120),
    locale,
    name,
    email,
    phone,
    phone_e164: parsedPhone.e164,
    path,
    source: text(body.source, 120),
    utm_source: text(body.utm_source, 120),
    utm_medium: text(body.utm_medium, 120),
    utm_campaign: text(body.utm_campaign, 160),
    utm_content: text(body.utm_content, 160),
    referrer: text(body.referrer, 500),
    user_agent: text(req.headers.get('user-agent'), 500),
    ip_hash: ipHash(req),
    interest: 'price_unlocked',
    metadata,
  }).select('id').single();
  if (error) {
    return NextResponse.json({ ok: false, error: { code: 'SUPABASE_ERROR', message: 'Unable to record lead' } }, { status: 500, headers });
  }
  return NextResponse.json({
    ok: true,
    lead_id: data.id,
    lead_token: createSignedMarketingToken({ kind: 'lead', id: data.id, email }),
  }, { headers });
}
