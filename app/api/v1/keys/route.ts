import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { generateApiKey } from '@/lib/api/api-key-auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { createClient } from '@supabase/supabase-js';

const VALID_SCOPES = [
  'calendar.read', 'calendar.write',
  'notes.read', 'notes.write',
  'skills.read', 'skills.write',
  'documents.read', 'documents.write',
  '*',
];

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * GET /api/v1/keys
 * List all API keys for the authenticated user (browser session auth).
 * Returns key metadata only — never the key itself.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const { supabase, user } = auth;

    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, last_used_at, expires_at, is_active, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message, 500);
    return apiSuccess({ keys: data || [] });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

/**
 * POST /api/v1/keys
 * Create a new API key. Returns the raw key ONCE — store it safely.
 *
 * Body:
 *   - name (required): Human-readable name
 *   - scopes (required): Array of scope strings
 *   - expires_in_days: Number of days until expiry (null = never)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const { user } = auth;

    const body = await req.json();
    const { name, scopes, expires_in_days } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'name is required');
    }
    if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'scopes is required (array of scope strings)');
    }

    const invalidScopes = scopes.filter((s: string) => !VALID_SCOPES.includes(s));
    if (invalidScopes.length > 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, `Invalid scopes: ${invalidScopes.join(', ')}. Valid: ${VALID_SCOPES.join(', ')}`);
    }

    const rawKey = generateApiKey();
    const keyHash = await hashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 11); // "fm_" + 8 chars

    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Use service role to insert (bypasses RLS for the insert)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: keyRecord, error } = await supabaseAdmin
      .from('api_keys')
      .insert({
        user_id: user.id,
        name: name.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes,
        expires_at: expiresAt,
      })
      .select('id, name, key_prefix, scopes, expires_at, created_at')
      .single();

    if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message, 500);

    // Return the raw key ONLY on creation — it can never be retrieved again
    return NextResponse.json({
      ok: true,
      key: {
        ...keyRecord,
        raw_key: rawKey,
      },
      warning: 'Store this API key securely. It will NOT be shown again.',
    }, { status: 201 });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

/**
 * DELETE /api/v1/keys
 * Deactivate an API key.
 *
 * Body:
 *   - key_id (required): UUID of the key to deactivate
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const { supabase, user } = auth;

    const body = await req.json();
    const { key_id } = body;

    if (!key_id) return apiError(ErrorCode.VALIDATION_ERROR, 'key_id is required');

    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', key_id)
      .eq('user_id', user.id);

    if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message, 500);
    return apiSuccess({ deactivated: true, key_id });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
