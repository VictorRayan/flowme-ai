import { NextRequest, NextResponse } from 'next/server';
import { getGoogleOAuthClient } from '@/lib/google/google-auth';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/google/callback?code=xxx&state=xxx
 * 
 * Google redirects here after the user grants consent.
 * We exchange the auth code for access/refresh tokens and store them
 * in user_google_tokens linked to the correct linked_account.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const errorParam = url.searchParams.get('error');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // User denied access
    if (errorParam) {
      return NextResponse.redirect(`${appUrl}/app/settings?google_error=access_denied`);
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(`${appUrl}/app/settings?google_error=missing_params`);
    }

    // Decode state to get user_id, linked_account_id, and optional connector_id
    let state: { user_id: string; linked_account_id: string; connector_id?: string | null; return_to?: string };
    try {
      state = JSON.parse(Buffer.from(stateParam, 'base64').toString());
    } catch {
      return NextResponse.redirect(`${appUrl}/app/settings?google_error=invalid_state`);
    }

    // Create Supabase client from cookies to verify current user matches state
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== state.user_id) {
      return NextResponse.redirect(`${appUrl}/app/settings?google_error=unauthorized`);
    }

    // Verify linked account exists and belongs to user
    const { data: account, error: accountError } = await supabase
      .from('linked_accounts')
      .select('id')
      .eq('id', state.linked_account_id)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .single();

    if (accountError || !account) {
      return NextResponse.redirect(`${appUrl}/app/settings?google_error=account_not_found`);
    }

    // Exchange code for tokens
    const oauth2Client = getGoogleOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(`${appUrl}/app/settings?google_error=no_access_token`);
    }

    // Upsert tokens into user_google_tokens
    // Use the service role key for this write so RLS doesn't block it
    // (The RLS policy checks linked_accounts ownership which requires a join)
    const { error: tokenError } = await supabase
      .from('user_google_tokens')
      .upsert({
        linked_account_id: state.linked_account_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : new Date(Date.now() + 3600 * 1000).toISOString(),
      }, {
        onConflict: 'linked_account_id',
      });

    if (tokenError) {
      console.error('Failed to store Google tokens:', tokenError);
      return NextResponse.redirect(`${appUrl}/app/settings?google_error=token_store_failed`);
    }

    const { error: accountUpdateError } = await supabase
      .from('linked_accounts')
      .update({ is_active: true })
      .eq('id', state.linked_account_id)
      .eq('user_id', user.id);

    if (accountUpdateError) {
      console.error('Failed to activate linked account after Google OAuth:', accountUpdateError);
      return NextResponse.redirect(`${appUrl}/app/settings?google_error=token_store_failed`);
    }

    // If OAuth was triggered from a connector, link it to this linked_account
    if (state.connector_id) {
      await supabase
        .from('connectors')
        .update({
          config: { linked_account_id: state.linked_account_id },
          is_active: true,
        })
        .eq('id', state.connector_id)
        .eq('user_id', user.id);
    }

    const returnTo = state.return_to || '/app/settings';
    const successParam = state.connector_id
      ? `connector_connected=${state.connector_id}`
      : `google_connected=${state.linked_account_id}`;

    return NextResponse.redirect(`${appUrl}${returnTo}?${successParam}`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${appUrl}/app/settings?google_error=internal`);
  }
}
