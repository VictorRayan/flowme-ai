import { NextRequest, NextResponse } from 'next/server';
import {
  createMarketingCsrfToken,
  isAllowedMarketingOrigin,
  marketingCorsHeaders,
  marketingOptions,
  requestOrigin,
} from '@/lib/marketing/security';

export function OPTIONS(req: NextRequest) {
  return marketingOptions(req);
}

export async function GET(req: NextRequest) {
  const origin = requestOrigin(req);
  if (!isAllowedMarketingOrigin(origin)) {
    return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Origin not allowed' } }, { status: 403 });
  }
  return NextResponse.json(
    { ok: true, token: createMarketingCsrfToken(origin), expires_in_seconds: 900 },
    { headers: marketingCorsHeaders(origin) }
  );
}
