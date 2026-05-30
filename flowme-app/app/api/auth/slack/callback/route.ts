import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { decodeSlackState, exchangeSlackCode } from '@/lib/slack/slack-oauth';

// GET /api/auth/slack/callback?code=xxx&state=xxx
// Mirrors /api/auth/google/callback. Trades the code for a user token and
// stores it in user_slack_tokens scoped to the linked account.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const errorParam = url.searchParams.get('error');

    if (errorParam) {
      const fallback = stateParam ? decodeSlackState(stateParam)?.return_to : null;
      return NextResponse.redirect(`${appUrl}${fallback || '/app/connectors'}?slack_error=access_denied`);
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(`${appUrl}/app/connectors?slack_error=missing_params`);
    }

    const state = decodeSlackState(stateParam);
    if (!state) {
      return NextResponse.redirect(`${appUrl}/app/connectors?slack_error=invalid_state`);
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value; } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== state.user_id) {
      return NextResponse.redirect(`${appUrl}/app/connectors?slack_error=unauthorized`);
    }

    const { data: account, error: accountError } = await supabase
      .from('linked_accounts')
      .select('id')
      .eq('id', state.linked_account_id)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .single();

    if (accountError || !account) {
      return NextResponse.redirect(`${appUrl}/app/connectors?slack_error=account_not_found`);
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(`${appUrl}/app/connectors?slack_error=server_misconfigured`);
    }

    let exchange;
    try {
      exchange = await exchangeSlackCode({ code, clientId, clientSecret, redirectUri });
    } catch (err) {
      console.error('Slack OAuth exchange failed:', err);
      return NextResponse.redirect(`${appUrl}/app/connectors?slack_error=exchange_failed`);
    }

    const { error: tokenError } = await supabase
      .from('user_slack_tokens')
      .upsert({
        linked_account_id: state.linked_account_id,
        access_token: exchange.user_access_token,
        refresh_token: exchange.user_refresh_token,
        expiry: exchange.expiry,
        slack_team_id: exchange.slack_team_id,
        slack_team_name: exchange.slack_team_name,
        slack_user_id: exchange.slack_user_id,
        scopes: exchange.scopes,
      }, { onConflict: 'linked_account_id' });

    if (tokenError) {
      console.error('Failed to store Slack tokens:', tokenError);
      return NextResponse.redirect(`${appUrl}/app/connectors?slack_error=token_store_failed`);
    }

    const { error: accountUpdateError } = await supabase
      .from('linked_accounts')
      .update({ is_active: true })
      .eq('id', state.linked_account_id)
      .eq('user_id', user.id);

    if (accountUpdateError) {
      console.error('Failed to activate linked account after Slack OAuth:', accountUpdateError);
      return NextResponse.redirect(`${appUrl}/app/connectors?slack_error=token_store_failed`);
    }

    if (state.connector_id) {
      const { error: connectorUpdateError } = await supabase
        .from('connectors')
        .update({
          config: { linked_account_id: state.linked_account_id },
          is_active: true,
        })
        .eq('id', state.connector_id)
        .eq('user_id', user.id);

      if (connectorUpdateError) {
        console.error('Failed to link connector after Slack OAuth:', connectorUpdateError);
        return NextResponse.redirect(`${appUrl}${state.return_to || '/app/connectors'}?slack_error=connector_link_failed`);
      }
    }

    const returnTo = state.return_to || '/app/connectors';
    const successParam = state.connector_id
      ? `connector_connected=${state.connector_id}`
      : `slack_connected=${state.linked_account_id}`;
    return NextResponse.redirect(`${appUrl}${returnTo}?${successParam}`);
  } catch (err) {
    console.error('Slack OAuth callback error:', err);
    return NextResponse.redirect(`${appUrl}/app/connectors?slack_error=internal`);
  }
}
