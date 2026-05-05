import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';
import { getGoogleOAuthClient } from '@/lib/google/google-auth';

/**
 * GET /api/auth/google/connect?linked_account_id=xxx
 * 
 * Initiates Google OAuth flow for a specific linked account.
 * Redirects the user to Google's consent screen.
 * The linked_account_id is passed via the `state` parameter so the callback
 * can associate the tokens with the correct account.
 */
export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const url = new URL(req.url);
    const linkedAccountId = url.searchParams.get('linked_account_id');
    const connectorId = url.searchParams.get('connector_id'); // optional: link OAuth to a connector

    if (!linkedAccountId) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'linked_account_id is required');
    }

    // Verify the account belongs to the user
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

    // If connector_id provided, verify it belongs to the user
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

    const oauth2Client = getGoogleOAuthClient();

    const state = Buffer.from(JSON.stringify({
      user_id: user.id,
      linked_account_id: linkedAccountId,
      connector_id: connectorId || null,
      return_to: connectorId ? '/app/connectors' : '/app/settings',
    })).toString('base64');

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/documents',
      ],
      state,
    });

    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('GET /api/auth/google/connect error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
