import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://flow-me.online',
  'https://www.flow-me.online',
  'https://app.flow-me.online',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:3000',
];

const TOKEN_TTL_MS = 15 * 60 * 1000;

function secret() {
  return process.env.MARKETING_CSRF_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'flowme-local-marketing-secret';
}

export function allowedMarketingOrigins() {
  return (process.env.MARKETING_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

export function requestOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin) return origin;
  const referer = req.headers.get('referer');
  if (!referer) return '';
  try {
    return new URL(referer).origin;
  } catch {
    return '';
  }
}

export function isAllowedMarketingOrigin(origin: string) {
  return allowedMarketingOrigins().includes(origin);
}

export function marketingCorsHeaders(origin: string): Record<string, string> {
  if (!origin || !isAllowedMarketingOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-FlowMe-CSRF',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export function marketingOptions(req: NextRequest) {
  const origin = requestOrigin(req);
  if (!isAllowedMarketingOrigin(origin)) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: marketingCorsHeaders(origin) });
}

export function createMarketingCsrfToken(origin: string, now = Date.now()) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = now + TOKEN_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ origin, expiresAt, nonce }), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret()).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

export function verifyMarketingCsrfToken(token: string, origin: string, now = Date.now()) {
  if (!origin || !isAllowedMarketingOrigin(origin) || !token) return false;
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return false;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { origin?: string; expiresAt?: number; nonce?: string };
    if (decoded.origin !== origin || !decoded.nonce) return false;
    const expiresAt = Number(decoded.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt < now) return false;
    const expected = crypto.createHmac('sha256', secret()).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function ipHash(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '';
  if (!ip) return null;
  return crypto.createHash('sha256').update(`${secret()}:${ip}`).digest('hex');
}
