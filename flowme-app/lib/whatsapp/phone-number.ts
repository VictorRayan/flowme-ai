import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js';

export interface InternationalPhoneNumber {
  e164: string;
  digits: string;
  formatted: string;
}

function cleanInternationalInput(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  const digits = cleaned.replace(/\+/g, '');
  return cleaned.startsWith('+') ? `+${digits}` : digits;
}

export function formatInternationalPhoneInput(raw: string): string {
  const cleaned = cleanInternationalInput(raw);
  if (!cleaned.startsWith('+')) return cleaned;
  return new AsYouType().input(cleaned);
}

export function parseInternationalPhone(raw: string): InternationalPhoneNumber | null {
  const cleaned = cleanInternationalInput(raw);
  if (!cleaned.startsWith('+')) return null;
  const phone = parsePhoneNumberFromString(cleaned);
  if (!phone?.isValid()) return null;
  return {
    e164: phone.number,
    digits: phone.number.slice(1),
    formatted: phone.formatInternational(),
  };
}

export function formatStoredInternationalPhone(digits: string): string {
  return parseInternationalPhone(`+${digits}`)?.formatted || `+${digits}`;
}
