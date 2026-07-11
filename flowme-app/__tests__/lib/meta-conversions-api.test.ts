import crypto from 'crypto';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

describe('Meta Conversions API', () => {
  const originalEnv = process.env;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    fetchMock.mockReset();
    process.env = {
      ...originalEnv,
      META_PIXEL_ID: 'pixel-123',
      META_ACCESS_TOKEN: 'token-123',
      NODE_ENV: 'test',
    };
    delete process.env.META_TEST_EVENT_CODE;
    delete process.env.META_CAPI_DEBUG;
    global.fetch = fetchMock;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('sends hashed user identifiers and browser matching fields', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const { sendMetaEvent } = await import('@/lib/meta/conversions-api');

    await sendMetaEvent(
      {
        event_name: 'Purchase',
        event_id: 'purchase-1',
        event_source_url: 'https://app.flow-me.online/checkout',
        external_id: 'visitor-1',
        name: 'Victor Rayan',
        email: 'Victor@Example.com',
        phone: '+55 (11) 99999-9999',
        fbp: 'fb.1.123.abc',
        fbc: 'fb.1.123.click',
        value: 59.9,
        currency: 'BRL',
      },
      '203.0.113.10',
      'Mozilla/5.0',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v19.0/pixel-123/events?access_token=token-123');
    const body = JSON.parse(init.body);
    expect(body.data[0]).toMatchObject({
      event_name: 'Purchase',
      event_id: 'purchase-1',
      event_source_url: 'https://app.flow-me.online/checkout',
      action_source: 'website',
      custom_data: { value: 59.9, currency: 'BRL' },
    });
    expect(body.data[0].user_data).toMatchObject({
      external_id: sha256('visitor-1'),
      fn: sha256('Victor'),
      ln: sha256('Rayan'),
      em: sha256('Victor@Example.com'),
      ph: sha256('5511999999999'),
      fbp: 'fb.1.123.abc',
      fbc: 'fb.1.123.click',
      client_ip_address: '203.0.113.10',
      client_user_agent: 'Mozilla/5.0',
    });
    expect(body).not.toHaveProperty('test_event_code');
  });

  it('includes test_event_code when META_TEST_EVENT_CODE is set', async () => {
    process.env.META_TEST_EVENT_CODE = 'TEST44787';
    fetchMock.mockResolvedValue({ ok: true });
    const { sendMetaEvent } = await import('@/lib/meta/conversions-api');

    await sendMetaEvent({
      event_name: 'Lead',
      event_id: 'lead-1',
      event_source_url: 'https://flow-me.online/',
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).test_event_code).toBe('TEST44787');
  });

  it('logs a delivery failure when Meta rejects the event', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"error":{"message":"Invalid parameter","fbtrace_id":"abc"}}',
    });
    const { sendMetaEvent } = await import('@/lib/meta/conversions-api');

    await sendMetaEvent({
      event_name: 'Purchase',
      event_id: 'purchase-err',
      event_source_url: 'https://app.flow-me.online/checkout',
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain('HTTP 400');
    errorSpy.mockRestore();
  });

  it('skips the request when credentials are missing', async () => {
    delete process.env.META_PIXEL_ID;
    delete process.env.META_ACCESS_TOKEN;
    const { sendMetaEvent } = await import('@/lib/meta/conversions-api');

    await sendMetaEvent({
      event_name: 'Lead',
      event_id: 'lead-2',
      event_source_url: 'https://flow-me.online/',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
