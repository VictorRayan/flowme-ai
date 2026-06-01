import {
  formatInternationalPhoneInput,
  formatStoredInternationalPhone,
  parseInternationalPhone,
} from '@/lib/whatsapp/phone-number';

describe('international WhatsApp phone numbers', () => {
  it('formats a Brazilian number while the user types', () => {
    expect(formatInternationalPhoneInput('+5511991226950')).toBe('+55 11 99122 6950');
  });

  it('normalizes valid international numbers from different countries', () => {
    expect(parseInternationalPhone('+55 (11) 99122-6950')).toEqual({
      e164: '+5511991226950',
      digits: '5511991226950',
      formatted: '+55 11 99122 6950',
    });
    expect(parseInternationalPhone('+1 (415) 555-2671')?.digits).toBe('14155552671');
    expect(parseInternationalPhone('+44 20 7946 0958')?.digits).toBe('442079460958');
  });

  it('requires the explicit international prefix', () => {
    expect(parseInternationalPhone('5511991226950')).toBeNull();
  });

  it('rejects numbers that do not exist in the country numbering plan', () => {
    expect(parseInternationalPhone('+1 123 456 7890')).toBeNull();
    expect(parseInternationalPhone('+999 123 456 789')).toBeNull();
  });

  it('formats stored digits for display and falls back safely for legacy values', () => {
    expect(formatStoredInternationalPhone('5511991226950')).toBe('+55 11 99122 6950');
    expect(formatStoredInternationalPhone('123')).toBe('+123');
  });
});
