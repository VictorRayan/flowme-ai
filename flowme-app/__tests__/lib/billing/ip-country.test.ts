import { IpCountryResolver, isPublicIp, normalizeIp, requestClientIp } from '@/lib/billing/ip-country';

describe('IP country resolution', () => {
  it('uses the first public client address from proxy forwarding', () => {
    expect(requestClientIp(new Headers({ 'x-forwarded-for': '1.1.1.1, 8.8.8.8' }))).toBe('1.1.1.1');
    expect(requestClientIp(new Headers({ 'x-forwarded-for': '10.0.0.1, 200.160.2.3, 172.16.0.1' }))).toBe('200.160.2.3');
    expect(requestClientIp(new Headers({ 'x-real-ip': '200.160.2.3' }))).toBe('200.160.2.3');
  });

  it('normalizes mapped IPv4 and rejects invalid input', () => {
    expect(normalizeIp('::ffff:200.160.2.3')).toBe('200.160.2.3');
    expect(normalizeIp('Brazil')).toBeNull();
  });

  it('rejects private and loopback addresses', () => {
    expect(isPublicIp('10.0.0.1')).toBe(false);
    expect(isPublicIp('192.168.1.1')).toBe(false);
    expect(isPublicIp('::1')).toBe(false);
    expect(isPublicIp('8.8.8.8')).toBe(true);
  });

  it('resolves and caches an ISO country without exposing the IP elsewhere', async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ country_code: 'br' }), { status: 200 }));
    const resolver = new IpCountryResolver({ token: 'token', fetcher, cacheTtlMs: 1000 });
    await expect(resolver.resolve('200.160.2.3')).resolves.toBe('BR');
    await expect(resolver.resolve('200.160.2.3')).resolves.toBe('BR');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('fails closed after bounded provider failures', async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response('{}', { status: 503 }));
    const resolver = new IpCountryResolver({ token: 'token', fetcher, timeoutMs: 50 });
    await expect(resolver.resolve('8.8.8.8')).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
