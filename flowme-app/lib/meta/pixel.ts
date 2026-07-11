/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

/** Type-safe wrapper around window.fbq — no-ops when Pixel is not loaded. */
export function fbq(...args: any[]): void {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq(...args);
  }
}

/** Generates a unique event ID for Pixel ↔ Conversions API deduplication. */
export function generateEventId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '')
    : Math.random().toString(36).slice(2);
  return `${prefix}_${Date.now()}_${rand}`;
}

/** Reads a cookie value by name from document.cookie. */
export function readCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : '';
}

export function writeCookie(name: string, value: string, domain?: string): void {
  if (typeof document === 'undefined' || !value) return;
  const maxAge = 90 * 24 * 60 * 60;
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  const cookieDomain = domain ? `; domain=${domain}` : '';
  document.cookie = `${name}=${encodeURIComponent(value)}${cookieDomain}; path=/; max-age=${maxAge}; samesite=lax${secure}`;
}

/**
 * Builds the _fbc value from a fbclid query parameter.
 * Format: fb.1.<creation_time_ms>.<fbclid>
 */
export function fbcFromFbclid(fbclid: string): string {
  return `fb.1.${Date.now()}.${fbclid}`;
}
