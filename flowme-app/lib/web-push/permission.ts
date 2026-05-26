export type BrowserNotificationPermissionResult =
  | { ok: true; permission: 'granted' }
  | { ok: false; permission?: Exclude<NotificationPermission, 'granted'>; reason: 'unsupported' | 'denied' | 'dismissed' };

export function canRequestBrowserNotificationPermission(): boolean {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && typeof Notification.requestPermission === 'function';
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermissionResult> {
  if (!canRequestBrowserNotificationPermission()) return { ok: false, reason: 'unsupported' };

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') return { ok: true, permission };
    return {
      ok: false,
      permission,
      reason: permission === 'denied' ? 'denied' : 'dismissed',
    };
  } catch {
    return { ok: false, reason: 'unsupported' };
  }
}
