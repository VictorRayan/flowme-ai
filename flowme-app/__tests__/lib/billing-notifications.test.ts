import { billingNotificationContent, deliverBillingNotification } from '@/lib/billing/notifications';

function makeAdmin() {
  const updateChain: any = {
    eq: jest.fn().mockReturnThis(),
    then(resolve: Function) { return Promise.resolve({ error: null }).then(resolve as any); },
  };
  const channelQuery: any = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { phone: '5511999999999' }, error: null }),
  };
  const notificationQuery = { update: jest.fn().mockReturnValue(updateChain) };
  return {
    admin: {
      from: jest.fn((table: string) => table === 'whatsapp_channels' ? channelQuery : notificationQuery),
    } as any,
    notificationQuery,
  };
}

describe('billing notifications', () => {
  it('builds provider-aware payment failure content', () => {
    expect(billingNotificationContent('payment_failed', 'stripe')).toEqual(expect.objectContaining({
      title: 'Não conseguimos renovar seu Flow Me Pro',
      url: '/app/settings?billing=payment_failed',
    }));
    expect(billingNotificationContent('payment_action_required', 'stripe').body).toContain('confirme');
  });

  it('delivers through available channels and marks the notification sent', async () => {
    const { admin, notificationQuery } = makeAdmin();
    const sendWeb = jest.fn().mockResolvedValue({ ok: true });
    const sendMobile = jest.fn().mockResolvedValue({ attempted: 1, delivered: 1 });
    const sendWhatsapp = jest.fn().mockResolvedValue(undefined);

    const result = await deliverBillingNotification(admin, {
      id: 'notification-1', userId: 'user-1', kind: 'payment_failed', provider: 'stripe',
      attempts: 0, channelResults: {},
    }, { sendWeb, sendMobile, sendWhatsapp });

    expect(result.status).toBe('sent');
    expect(result.channels).toEqual(['web_push', 'mobile_push', 'whatsapp']);
    expect(notificationQuery.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }));
  });

  it('schedules transient channel failures without resending successful channels', async () => {
    const { admin, notificationQuery } = makeAdmin();
    const sendWeb = jest.fn().mockResolvedValue({ ok: true });
    const sendMobile = jest.fn().mockResolvedValue({ attempted: 1, delivered: 0 });
    const sendWhatsapp = jest.fn().mockRejectedValue(new Error('temporary'));

    const result = await deliverBillingNotification(admin, {
      id: 'notification-1', userId: 'user-1', kind: 'payment_failed', provider: 'stripe',
      attempts: 0, channelResults: {},
    }, { sendWeb, sendMobile, sendWhatsapp });

    expect(result.status).toBe('pending');
    expect(notificationQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending', attempts: 1, processing_started_at: null,
    }));
  });
});
