import { createHmac, timingSafeEqual } from 'crypto';

type TokenPayload = {
  kind: 'lead' | 'public_checkout';
  id: string;
  email: string;
  exp: number;
};

function secret() {
  const value = process.env.PUBLIC_CHECKOUT_TOKEN_SECRET
    || process.env.MARKETING_CSRF_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error('Public checkout token secret is not configured');
  return value;
}

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createSignedMarketingToken(input: { kind: TokenPayload['kind']; id: string; email: string; ttlSeconds?: number }) {
  const payload: TokenPayload = {
    kind: input.kind,
    id: input.id,
    email: normalizeEmail(input.email),
    exp: Math.floor(Date.now() / 1000) + (input.ttlSeconds || 60 * 60 * 24 * 14),
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifySignedMarketingToken(token: string, kind: TokenPayload['kind']): TokenPayload | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (payload.kind !== kind || !payload.id || !payload.email || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { ...payload, email: normalizeEmail(payload.email) };
  } catch {
    return null;
  }
}
