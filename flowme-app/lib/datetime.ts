import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import type { UiLang } from './i18n';

// The UI ships in English and Português-BR. Every user-facing date, weekday, or
// month name must follow the configured UI language — never the browser default.

export function dayjsLocale(lang: UiLang): string {
  return lang === 'pt' ? 'pt-br' : 'en';
}

export function intlLocale(lang: UiLang): string {
  return lang === 'pt' ? 'pt-BR' : 'en-US';
}

// Sets dayjs's global default locale. Call this when the UI language changes so
// any `dayjs(x).format(...)` across the app renders in the right language.
export function applyDayjsLocale(lang: UiLang): void {
  dayjs.locale(dayjsLocale(lang));
}

// Deterministic per-call formatting — does not depend on the global locale.
export function formatDate(date: dayjs.ConfigType, fmt: string, lang: UiLang): string {
  return dayjs(date).locale(dayjsLocale(lang)).format(fmt);
}
