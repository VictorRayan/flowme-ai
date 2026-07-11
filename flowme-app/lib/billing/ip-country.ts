import { isIP } from 'node:net';

type Fetcher = typeof fetch;

type CacheEntry = { countryCode: string | null; expiresAt: number };

export function requestClientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')
    ?.split(',')
    .map(value => value.trim())
    .filter(Boolean);
  for (const value of forwarded || []) {
    const ip = normalizeIp(value);
    if (ip && isPublicIp(ip)) return ip;
  }
  return normalizeIp(headers.get('x-real-ip'));
}

export function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const unwrapped = value.trim().replace(/^\[|\]$/g, '');
  const normalized = unwrapped.startsWith('::ffff:') ? unwrapped.slice(7) : unwrapped;
  return isIP(normalized) ? normalized : null;
}

export function isPublicIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return !(a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168));
  }
  if (isIP(ip) === 6) {
    const value = ip.toLowerCase();
    return value !== '::1' && value !== '::' && !value.startsWith('fc') && !value.startsWith('fd') && !value.startsWith('fe8') && !value.startsWith('fe9') && !value.startsWith('fea') && !value.startsWith('feb');
  }
  return false;
}

export class IpCountryResolver {
  private readonly fetcher: Fetcher;
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(options: { token: string; fetcher?: Fetcher; baseUrl?: string; timeoutMs?: number; cacheTtlMs?: number }) {
    this.token = options.token;
    this.fetcher = options.fetcher || fetch;
    this.baseUrl = (options.baseUrl || 'https://api.ipinfo.io/lite').replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs || 2000;
    this.cacheTtlMs = options.cacheTtlMs || 15 * 60 * 1000;
  }

  async resolve(ip: string | null): Promise<string | null> {
    if (!this.token || !ip || !isPublicIp(ip)) return null;
    const cached = this.cache.get(ip);
    if (cached && cached.expiresAt > Date.now()) return cached.countryCode;

    let countryCode: string | null = null;
    for (let attempt = 0; attempt < 2 && !countryCode; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetcher(`${this.baseUrl}/${encodeURIComponent(ip)}?token=${encodeURIComponent(this.token)}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) continue;
        const payload = await response.json() as { country_code?: unknown };
        if (typeof payload.country_code === 'string' && /^[A-Za-z]{2}$/.test(payload.country_code)) {
          countryCode = payload.country_code.toUpperCase();
        }
      } catch {
        countryCode = null;
      } finally {
        clearTimeout(timeout);
      }
    }

    this.cache.set(ip, { countryCode, expiresAt: Date.now() + this.cacheTtlMs });
    return countryCode;
  }
}

let productionResolver: IpCountryResolver | null = null;

export async function resolveRequestCountry(headers: Headers): Promise<string | null> {
  productionResolver ||= new IpCountryResolver({
    token: process.env.IPINFO_TOKEN || '',
    baseUrl: process.env.IPINFO_API_URL,
  });
  return productionResolver.resolve(requestClientIp(headers));
}
