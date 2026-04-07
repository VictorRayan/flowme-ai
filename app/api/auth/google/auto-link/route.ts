import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

/**
 * POST /api/auth/google/auto-link
 * 
 * Called after Supabase Google OAuth sign-in.
 * Automatically creates a "Primary" linked account and stores the
 * Google provider tokens from the Supabase session so the user
 * can immediately use Google Calendar features without a separate
 * OAuth flow.
 * 
 * For ADDITIONAL Google accounts, the user still uses the
 * /api/auth/google/connect flow (separate OAuth consent).
 */
export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();
    const body = await req.json();
    const { provider_token, provider_refresh_token } = body;

    if (!provider_token) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'provider_token is required');
    }

    // Get user email from profile
    const userEmail = user.email || 'My Google Account';

    // Check if user already has a linked account (avoid duplicates on re-login)
    const { data: existing } = await supabase
      .from('linked_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .limit(1);

    let accountId: string;

    if (existing && existing.length > 0) {
      // Already has an account — update its tokens
      accountId = existing[0].id;
    } else {
      // Create the primary linked account
      const { data: newAccount, error: insertError } = await supabase
        .from('linked_accounts')
        .insert({
          user_id: user.id,
          name: userEmail,
          type: 'personal',
          provider: 'google',
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Auto-link insert error:', insertError);
        return apiError(ErrorCode.SUPABASE_ERROR, 'Failed to create linked account');
      }

      accountId = newAccount.id;
    }

    // Upsert the Google tokens
    const { error: tokenError } = await supabase
      .from('user_google_tokens')
      .upsert({
        linked_account_id: accountId,
        access_token: provider_token,
        refresh_token: provider_refresh_token || null,
        expiry: new Date(Date.now() + 3600 * 1000).toISOString(), // ~1 hour from now
      }, {
        onConflict: 'linked_account_id',
      });

    if (tokenError) {
      console.error('Auto-link token upsert error:', tokenError);
      return apiError(ErrorCode.SUPABASE_ERROR, 'Failed to store Google tokens');
    }

    return apiSuccess({ linked_account_id: accountId });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('POST /api/auth/google/auto-link error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
