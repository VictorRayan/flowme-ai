import { applyDayjsLocale, dayjsLocale, formatDate, intlLocale } from '@/lib/datetime';
import dayjs from 'dayjs';

describe('datetime locale helpers', () => {
  afterEach(() => dayjs.locale('en'));

  it('maps UI language to dayjs and Intl locales', () => {
    expect(dayjsLocale('pt')).toBe('pt-br');
    expect(dayjsLocale('en')).toBe('en');
    expect(intlLocale('pt')).toBe('pt-BR');
    expect(intlLocale('en')).toBe('en-US');
  });

  it('formats weekday and month names in Portuguese without touching the global locale', () => {
    // 2026-05-11 is a Monday
    expect(formatDate('2026-05-11', 'dddd', 'pt').toLowerCase()).toContain('segunda');
    expect(formatDate('2026-05-11', 'MMMM', 'pt').toLowerCase()).toContain('maio');
    // global locale stays English
    expect(dayjs('2026-05-11').format('MMMM')).toBe('May');
  });

  it('formats weekday and month names in English', () => {
    expect(formatDate('2026-05-11', 'dddd', 'en')).toBe('Monday');
    expect(formatDate('2026-05-11', 'MMM D, YYYY', 'en')).toBe('May 11, 2026');
  });

  it('applyDayjsLocale switches the global default', () => {
    applyDayjsLocale('pt');
    expect(dayjs('2026-05-11').format('MMMM').toLowerCase()).toContain('maio');
    applyDayjsLocale('en');
    expect(dayjs('2026-05-11').format('MMMM')).toBe('May');
  });
});
