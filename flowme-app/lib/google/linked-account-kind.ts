const CONNECTOR_ACCOUNT_NAME_PATTERNS = [
  /\((gmail|google docs|google sheets|google drive)\)/i,
];

export function isConnectorLinkedAccountName(name: string | null | undefined): boolean {
  const text = String(name || '').trim();
  return CONNECTOR_ACCOUNT_NAME_PATTERNS.some((pattern) => pattern.test(text));
}

export function isCalendarLinkedAccountName(name: string | null | undefined): boolean {
  return !isConnectorLinkedAccountName(name);
}
