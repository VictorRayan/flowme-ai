import { NextRequest, NextResponse } from 'next/server';
import { sendMetaEvent, type MetaEventName } from '@/lib/meta/conversions-api';

const ALLOWED_EVENTS: MetaEventName[] = [
  'PageView',
  'ViewContent',
  'Lead',
  'InitiateCheckout',
  'AddPaymentInfo',
  'Purchase',
];

const ALLOWED_ORIGINS = new Set([
  'https://flow-me.online',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
]);

function corsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin');
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://flow-me.online';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// Allow the LP (flow-me.online) and local LP previews to call this endpoint.
const BASE_CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: { ...BASE_CORS_HEADERS, ...corsHeaders(request) } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers: corsHeaders(request) });
  }

  const event_name = body.event_name as MetaEventName;
  if (!ALLOWED_EVENTS.includes(event_name)) {
    return NextResponse.json({ ok: false, error: 'invalid_event' }, { status: 400, headers: corsHeaders(request) });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = request.headers.get('user-agent') ?? null;

  // Fire-and-forget — do not block the response on CAPI latency
  sendMetaEvent(
    {
      event_name,
      event_id: String(body.event_id ?? ''),
      event_source_url: String(body.event_source_url ?? 'https://app.flow-me.online/checkout'),
      email: body.email ? String(body.email) : undefined,
      phone: body.phone ? String(body.phone) : undefined,
      fbp: body.fbp ? String(body.fbp) : undefined,
      fbc: body.fbc ? String(body.fbc) : undefined,
      value: typeof body.value === 'number' ? body.value : undefined,
      currency: body.currency ? String(body.currency) : undefined,
    },
    ip,
    userAgent,
  ).catch((err) => console.error('[meta/event] CAPI dispatch failed', err));

  return NextResponse.json({ ok: true }, { headers: corsHeaders(request) });
}
