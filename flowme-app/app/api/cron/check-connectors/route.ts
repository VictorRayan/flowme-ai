import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import {
  connectorReconnectMessage,
  isGoogleConnectorType,
  resolveGoogleConnectorHealth,
  type ConnectorHealthRow,
} from '@/lib/connectors/reconnect';
import { sendText } from '@/lib/whatsapp/evolution-client';

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`);
}

function shouldNotify(config: Record<string, any> | null | undefined): boolean {
  const last = config?.last_reconnect_notice_at;
  if (typeof last !== 'string') return true;
  const lastTime = new Date(last).getTime();
  if (!Number.isFinite(lastTime)) return true;
  return Date.now() - lastTime > 12 * 60 * 60 * 1000;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: connectors, error } = await admin
    .from('connectors')
    .select('id,user_id,name,type,is_active,config,created_at')
    .eq('is_active', true);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let checked = 0;
  let needsReconnect = 0;
  let notified = 0;

  for (const connector of (connectors || []) as ConnectorHealthRow[]) {
    if (!isGoogleConnectorType(connector.type) || !connector.config?.linked_account_id) continue;
    checked += 1;
    const status = await resolveGoogleConnectorHealth(admin, connector, connector.user_id ? { id: connector.user_id } : undefined);
    if (status !== 'needs_reconnect') continue;
    needsReconnect += 1;
    if (!connector.user_id || !shouldNotify(connector.config)) continue;

    const { data: channel } = await admin
      .from('whatsapp_channels')
      .select('phone')
      .eq('user_id', connector.user_id)
      .eq('status', 'active')
      .maybeSingle();

    if (!channel?.phone) continue;
    await sendText(channel.phone, connectorReconnectMessage(connector.name || 'Google'));
    notified += 1;

    await admin
      .from('connectors')
      .update({
        config: {
          ...(connector.config || {}),
          connection_status: 'needs_reconnect',
          last_reconnect_notice_at: new Date().toISOString(),
        },
      })
      .eq('id', connector.id);
  }

  return NextResponse.json({ ok: true, checked, needs_reconnect: needsReconnect, notified });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
