import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';
import { buildSlackAuthorizeUrl, encodeSlackState } from '@/lib/slack/slack-oauth';

// GET /api/auth/slack/connect?linked_account_id=xxx&connector_id=yyy
// Mirrors /api/auth/google/connect. Redirects to Slack's consent screen.
export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const url = new URL(req.url);
    const linkedAccountId = url.searchParams.get('linked_account_id');
    const connectorId = url.searchParams.get('connector_id');

    if (!linkedAccountId) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'linked_account_id is required');
    }

    const { data: account, error } = await supabase
      .from('linked_accounts')
      .select('id, user_id')
      .eq('id', linkedAccountId)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .single();

    if (error || !account) {
      return apiError(ErrorCode.NOT_FOUND, 'Linked account not found', 404);
    }

    if (connectorId) {
      const { data: connector } = await supabase
        .from('connectors')
        .select('id')
        .eq('id', connectorId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!connector) {
        return apiError(ErrorCode.NOT_FOUND, 'Connector not found', 404);
      }
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return apiError(ErrorCode.INTERNAL_ERROR, 'Slack OAuth is not configured on the server', 500);
    }

    const state = encodeSlackState({
      user_id: user.id,
      linked_account_id: linkedAccountId,
      connector_id: connectorId || null,
      return_to: connectorId ? '/app/connectors' : '/app/settings',
    });

    return NextResponse.redirect(buildSlackAuthorizeUrl({ clientId, redirectUri, state }));
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('GET /api/auth/slack/connect error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
