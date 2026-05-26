import { requestBrowserNotificationPermission } from '@/lib/web-push/permission';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export async function isPushSupported(): Promise<boolean> {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function registerWebPush(options: { permission?: NotificationPermission } = {}): Promise<{ ok: boolean; reason?: string }> {
  if (!(await isPushSupported())) return { ok: false, reason: 'unsupported' };

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const permission = options.permission ?? (await requestBrowserNotificationPermission()).permission;
  if (permission !== 'granted') return { ok: false, reason: 'permission-denied' };

  const keyRes = await fetch('/api/web-push/vapid-public-key');
  const keyJson = await keyRes.json();
  if (!keyJson?.publicKey) return { ok: false, reason: 'vapid-missing' };

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(keyJson.publicKey) as any,
  });

  const sub = subscription.toJSON();
  const res = await fetch('/api/web-push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys }),
  });
  if (!res.ok) return { ok: false, reason: 'subscribe-failed' };
  return { ok: true };
}

export async function unregisterWebPush(): Promise<void> {
  if (!(await isPushSupported())) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const subscription = await reg?.pushManager.getSubscription();
  if (subscription) {
    await fetch('/api/web-push/subscribe?endpoint=' + encodeURIComponent(subscription.endpoint), { method: 'DELETE' });
    await subscription.unsubscribe();
  }
}
