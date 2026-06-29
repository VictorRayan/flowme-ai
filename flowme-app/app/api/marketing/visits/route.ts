import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import {
  ipHash,
  marketingCorsHeaders,
  marketingOptions,
  requestOrigin,
  verifyMarketingCsrfToken,
} from '@/lib/marketing/security';

const LOCALES = ['pt-BR', 'en-US'] as const;
const SURFACES = ['landing', 'checkout'] as const;

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : null;
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
  const surface = SURFACES.includes(body.surface as typeof SURFACES[number]) ? body.surface as typeof SURFACES[number] : null;
  const path = text(body.path, 300);
  if (!locale || !surface || !path) {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'locale, surface and path are required' } }, { status: 400, headers });
  }

  const metadata = typeof body.metadata === 'object' && body.metadata !== null && !Array.isArray(body.metadata) ? body.metadata : {};
  const { data, error } = await getSupabaseAdmin().from('marketing_page_visits').insert({
    visitor_id: text(body.visitor_id, 120),
    session_id: text(body.session_id, 120),
    surface,
    locale,
    path,
    source: text(body.source, 120),
    utm_source: text(body.utm_source, 120),
    utm_medium: text(body.utm_medium, 120),
    utm_campaign: text(body.utm_campaign, 160),
    utm_content: text(body.utm_content, 160),
    referrer: text(body.referrer, 500),
    user_agent: text(req.headers.get('user-agent'), 500),
    ip_hash: ipHash(req),
    metadata,
  }).select('id').single();
  if (error) {
    return NextResponse.json({ ok: false, error: { code: 'SUPABASE_ERROR', message: 'Unable to record visit' } }, { status: 500, headers });
  }
  return NextResponse.json({ ok: true, visit_id: data.id }, { headers });
}
