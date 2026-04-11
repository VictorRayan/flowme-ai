import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { apiError, ErrorCode } from './errors';

/**
 * Authenticate requests using Bearer API key (for external AI integrations).
 * The key is hashed with SHA-256 and matched against `api_keys.key_hash`.
 *
 * Usage:
 *   const auth = await requireApiKeyAuth(request, ['calendar.read']);
 *   if (auth instanceof Response) return auth; // error response
 *   const { userId, supabase } = auth;
 */

interface ApiKeyAuthResult {
  userId: string;
  keyId: string;
  keyName: string;
  scopes: string[];
  supabase: any; // Service-role client without generated DB types
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'fm_';
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

export async function requireApiKeyAuth(
  request: NextRequest,
  requiredScopes: string[] = []
): Promise<ApiKeyAuthResult | Response> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return apiError(ErrorCode.UNAUTHORIZED, 'Missing or invalid Authorization header. Use: Bearer <api_key>', 401);
  }

  const apiKey = authHeader.slice(7).trim();

  if (!apiKey || !apiKey.startsWith('fm_')) {
    return apiError(ErrorCode.UNAUTHORIZED, 'Invalid API key format. Keys must start with "fm_"', 401);
  }

  // Use service role client to bypass RLS for key lookup
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const keyHash = await hashApiKey(apiKey);

  const { data: keyRecord, error } = await supabaseAdmin
    .from('api_keys')
    .select('id, user_id, name, scopes, is_active, expires_at')
    .eq('key_hash', keyHash)
    .single();

  if (error || !keyRecord) {
    return apiError(ErrorCode.UNAUTHORIZED, 'Invalid API key', 401);
  }

  if (!keyRecord.is_active) {
    return apiError(ErrorCode.UNAUTHORIZED, 'API key is deactivated', 401);
  }

  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return apiError(ErrorCode.UNAUTHORIZED, 'API key has expired', 401);
  }

  // Check scopes
  const keyScopes: string[] = keyRecord.scopes || [];
  const missingScopes = requiredScopes.filter(s => !keyScopes.includes(s) && !keyScopes.includes('*'));

  if (missingScopes.length > 0) {
    return apiError(
      ErrorCode.UNAUTHORIZED,
      `API key missing required scopes: ${missingScopes.join(', ')}`,
      403
    );
  }

  // Update last_used_at (fire-and-forget)
  supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRecord.id)
    .then(() => {});

  // Create a service-role client scoped for data operations
  // (we use service role because API key users don't have a Supabase session)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  return {
    userId: keyRecord.user_id,
    keyId: keyRecord.id,
    keyName: keyRecord.name,
    scopes: keyScopes,
    supabase,
  };
}
