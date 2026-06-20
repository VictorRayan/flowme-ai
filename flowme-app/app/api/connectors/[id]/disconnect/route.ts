import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { FeatureLockedError, requireFeature } from '@/lib/billing/entitlements';

// POST /api/connectors/[id]/disconnect
// Revokes the OAuth link from a connector (marks linked_account inactive, clears config).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    await requireFeature(getSupabaseAdmin(), user.id, 'connectors');
    const { id: connectorId } = await params;

    const { data: connector, error: connectorError } = await supabase
      .from('connectors')
      .select('id, type, config')
      .eq('id', connectorId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (connectorError || !connector) {
      return apiError(ErrorCode.NOT_FOUND, 'Connector not found', 404);
    }

    const linkedAccountId = connector.config?.linked_account_id as string | undefined;
    const tokenTable = connector.type === 'slack' ? 'user_slack_tokens' : 'user_google_tokens';

    // Mark linked account inactive if it was created for this connector
    if (linkedAccountId) {
      await supabase
        .from('linked_accounts')
        .update({ is_active: false })
        .eq('id', linkedAccountId)
        .eq('user_id', user.id);

      await supabase
        .from(tokenTable)
        .delete()
        .eq('linked_account_id', linkedAccountId);
    }

    // Clear connector auth config
    const { data: updated, error: updateError } = await supabase
      .from('connectors')
      .update({ config: {}, is_active: false })
      .eq('id', connectorId)
      .eq('user_id', user.id)
      .select('id, name, type, is_active, config, created_at')
      .single();

    if (updateError) throw updateError;

    return apiSuccess({ connector: updated });
  } catch (err: any) {
    if (err instanceof FeatureLockedError) {
      return apiError(ErrorCode.FEATURE_LOCKED, 'Connectors require Flow Me Pro', 402, {
        required_plan: err.required_plan,
        feature_key: err.feature,
        checkout_available: true,
      });
    }
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('POST /api/connectors/[id]/disconnect error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to disconnect connector', 500);
  }
}
