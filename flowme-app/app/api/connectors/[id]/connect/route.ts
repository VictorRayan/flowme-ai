import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';

function connectorAccountName(connector: { id: string; name: string; type: string }): string {
  return `${connector.name} (${connector.type.replace('_', ' ')}) ${connector.id.slice(0, 8)}`;
}

function googleConnectUrl(linkedAccountId: string, connectorId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${appUrl}/api/auth/google/connect?linked_account_id=${linkedAccountId}&connector_id=${connectorId}`;
}

// POST /api/connectors/[id]/connect
// Creates a linked_account if needed, then redirects to Google OAuth.
// After OAuth, the callback links the connector to the authorized account.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { id: connectorId } = await params;

    // Verify connector belongs to user
    const { data: connector, error: connectorError } = await supabase
      .from('connectors')
      .select('id, name, type, config')
      .eq('id', connectorId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (connectorError || !connector) {
      return apiError(ErrorCode.NOT_FOUND, 'Connector not found', 404);
    }

    // Reuse existing linked_account if connector already has one authorized
    const existingLinkedAccountId = connector.config?.linked_account_id as string | undefined;
    if (existingLinkedAccountId) {
      const { data: existing } = await supabase
        .from('linked_accounts')
        .select('id, is_active, is_deleted')
        .eq('id', existingLinkedAccountId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (existing && !existing.is_deleted) {
        return NextResponse.json({ ok: true, redirect_url: googleConnectUrl(existing.id, connectorId) });
      }
    }

    const { data: reusableAccount } = await supabase
      .from('linked_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .eq('is_deleted', false)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (reusableAccount?.id) {
      return NextResponse.json({ ok: true, redirect_url: googleConnectUrl(reusableAccount.id, connectorId) });
    }

    const accountName = connectorAccountName(connector);
    const { data: newAccount, error: accountError } = await supabase
      .from('linked_accounts')
      .insert({
        user_id: user.id,
        provider: 'google',
        name: accountName,
        type: 'personal',
        is_active: false, // becomes true after OAuth completes
      })
      .select('id')
      .single();

    if (accountError || !newAccount) {
      console.error('POST /api/connectors/[id]/connect linked_account insert error:', accountError);
      return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create linked account', 500);
    }

    return NextResponse.json({ ok: true, redirect_url: googleConnectUrl(newAccount.id, connectorId) });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('POST /api/connectors/[id]/connect error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to initiate connector auth', 500);
  }
}
