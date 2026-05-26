import {
  canRequestBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from '@/lib/web-push/permission';

describe('web push permission', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(global, 'window');
  const originalNotification = Object.getOwnPropertyDescriptor(global, 'Notification');

  afterEach(() => {
    if (originalWindow) Object.defineProperty(global, 'window', originalWindow);
    else delete (global as any).window;

    if (originalNotification) Object.defineProperty(global, 'Notification', originalNotification);
    else delete (global as any).Notification;
  });

  function mockNotification(permission: NotificationPermission) {
    const notification = {
      requestPermission: jest.fn().mockResolvedValue(permission),
    };
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: { Notification: notification },
    });
    Object.defineProperty(global, 'Notification', {
      configurable: true,
      value: notification,
    });
    return notification;
  }

  it('reports unsupported outside a browser notification context', async () => {
    delete (global as any).window;
    delete (global as any).Notification;

    expect(canRequestBrowserNotificationPermission()).toBe(false);
    await expect(requestBrowserNotificationPermission()).resolves.toEqual({ ok: false, reason: 'unsupported' });
  });

  it('requests the native browser permission and returns granted', async () => {
    const notification = mockNotification('granted');

    await expect(requestBrowserNotificationPermission()).resolves.toEqual({ ok: true, permission: 'granted' });
    expect(notification.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('maps denied and dismissed permissions to actionable reasons', async () => {
    mockNotification('denied');
    await expect(requestBrowserNotificationPermission()).resolves.toEqual({
      ok: false,
      permission: 'denied',
      reason: 'denied',
    });

    mockNotification('default');
    await expect(requestBrowserNotificationPermission()).resolves.toEqual({
      ok: false,
      permission: 'default',
      reason: 'dismissed',
    });
  });
});
