export function getAppBaseUrl(configuredAppUrl: string | undefined, currentOrigin: string) {
  const candidate = configuredAppUrl?.trim() || currentOrigin.trim();
  return candidate.replace(/\/+$/, '');
}

export function getAuthCallbackUrl(configuredAppUrl: string | undefined, currentOrigin: string) {
  return `${getAppBaseUrl(configuredAppUrl, currentOrigin)}/auth/callback`;
}
