import type { SupabaseClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { getValidGoogleToken } from '@/lib/google/google-auth';

export type ConnectorReconnectStatus = 'connected' | 'needs_connection' | 'needs_reconnect';

export type ConnectorHealthRow = {
  id?: string;
  user_id?: string;
  name?: string;
  type?: string;
  is_active?: boolean;
  config?: Record<string, any> | null;
};

const GOOGLE_CONNECTOR_TYPES = new Set(['gmail', 'google_docs', 'google_sheets', 'google_drive']);
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';
const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet';

export function isGoogleConnectorType(type: string | undefined): boolean {
  return Boolean(type && GOOGLE_CONNECTOR_TYPES.has(type));
}

export function isGoogleReconnectError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  const status = (error as any)?.response?.status || (error as any)?.code;
  const googleMessage = (error as any)?.response?.data?.error?.message || message;
  return status === 401
    || status === 403
    || /GOOGLE_AUTH_MISSING|GOOGLE_TOKEN_REFRESH_FAILED|insufficient authentication scopes|insufficient permission|permission_denied|scope|consent|unauthoriz/i.test(googleMessage);
}

export function reconnectUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${appUrl}/app/connectors`;
}

export function connectorReconnectMessage(connectorName = 'Google'): string {
  return [
    `Sua conexão com ${connectorName} precisa ser renovada para eu continuar acessando seus arquivos.`,
    `Abra o Flow Me e toque em Reconectar conta: ${reconnectUrl()}`,
  ].join('\n\n');
}

export async function markConnectorNeedsReconnect(
  supabase: Pick<SupabaseClient, 'from'>,
  connector: ConnectorHealthRow | null | undefined,
  reason: string,
) {
  if (!connector?.id) return;
  const config = connector.config || {};
  try {
    await supabase
      .from('connectors')
      .update({
        config: {
          ...config,
          connection_status: 'needs_reconnect',
          last_connection_error: reason.slice(0, 300),
          last_connection_checked_at: new Date().toISOString(),
        },
      })
      .eq('id', connector.id);
  } catch (error) {
    console.warn('[connectors] failed to mark connector needs_reconnect:', error);
  }
}

export async function resolveGoogleConnectorHealth(
  supabase: Pick<SupabaseClient, 'from'>,
  connector: ConnectorHealthRow,
  user?: { id: string },
): Promise<ConnectorReconnectStatus> {
  const linkedAccountId = connector.config?.linked_account_id;
  if (!connector.is_active || !linkedAccountId) return 'needs_connection';
  if (!isGoogleConnectorType(connector.type)) return connector.is_active ? 'connected' : 'needs_connection';

  try {
    const auth = await getValidGoogleToken(linkedAccountId, { supabase, user });
    if (connector.type === 'gmail') {
      await google.gmail({ version: 'v1', auth }).users.getProfile({ userId: 'me' });
    } else if (connector.type === 'google_docs') {
      await google.drive({ version: 'v3', auth }).files.list({
        q: `trashed = false and mimeType = '${GOOGLE_DOC_MIME}'`,
        pageSize: 1,
        fields: 'files(id)',
      });
    } else if (connector.type === 'google_sheets') {
      await google.drive({ version: 'v3', auth }).files.list({
        q: `trashed = false and mimeType = '${GOOGLE_SHEET_MIME}'`,
        pageSize: 1,
        fields: 'files(id)',
      });
    } else if (connector.type === 'google_drive') {
      await google.drive({ version: 'v3', auth }).files.list({
        q: 'trashed = false',
        pageSize: 1,
        fields: 'files(id)',
      });
    }
    if (connector.config?.connection_status === 'needs_reconnect') {
      await supabase
        .from('connectors')
        .update({
          config: {
            ...connector.config,
            connection_status: 'connected',
            last_connection_error: null,
            last_connection_checked_at: new Date().toISOString(),
          },
        })
        .eq('id', connector.id);
    }
    return 'connected';
  } catch (error) {
    await markConnectorNeedsReconnect(
      supabase,
      connector,
      error instanceof Error ? error.message : 'Google connection failed',
    );
    return 'needs_reconnect';
  }
}
