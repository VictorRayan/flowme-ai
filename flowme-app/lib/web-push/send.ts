type SupabaseLike = { from(table: string): unknown };
type Subscription = { id: string; endpoint: string; keys: { auth: string; p256dh: string } };
type SelectQuery = PromiseLike<{ data: Subscription[] | null; error: { message: string } | null }> & {
  select(columns: string): SelectQuery;
  eq(column: string, value: unknown): SelectQuery;
};
type DeleteQuery = {
  delete(): DeleteQuery;
  eq(column: string, value: unknown): PromiseLike<{ error: { message: string } | null }>;
};

export interface WebPushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendWebPush(
  supabase: SupabaseLike,
  userId: string,
  payload: WebPushPayload,
): Promise<{ ok: boolean; error?: string }> {
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:noreply@flow-me.online';
  if (!vapidPublic || !vapidPrivate) return { ok: false, error: 'vapid not configured' };

  const { data: subscriptions } = await (supabase.from('web_push_subscriptions') as SelectQuery)
    .select('id, endpoint, keys')
    .eq('user_id', userId);
  if (!subscriptions || subscriptions.length === 0) return { ok: false, error: 'no subscriptions' };

  const { default: webpush } = await import('web-push');
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  let failures = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload));
    } catch (err: unknown) {
      failures += 1;
      const statusCode = typeof err === 'object' && err && 'statusCode' in err ? Number(err.statusCode) : null;
      if (statusCode === 410 || statusCode === 404) {
        await (supabase.from('web_push_subscriptions') as DeleteQuery).delete().eq('id', sub.id);
      }
    }
  }
  return failures === subscriptions.length ? { ok: false, error: 'all push deliveries failed' } : { ok: true };
}
