export type OnboardingLang = 'pt' | 'en';

const COPY: Record<OnboardingLang, { next: string; finish: string }> = {
  pt: { next: 'Definir próximo objetivo', finish: 'Começar minha jornada' },
  en: { next: 'Define next goal',         finish: 'Start my journey' },
};

export function proposalButtonLabel(currentGoalIndex: number, goalCount: number, lang: OnboardingLang): string {
  const safeCount = Math.max(1, Math.floor(goalCount));
  const safeIndex = Math.max(1, Math.floor(currentGoalIndex));
  const t = COPY[lang] || COPY.pt;
  return safeIndex < safeCount ? t.next : t.finish;
}

const FINISHING_COPY: Record<OnboardingLang, string> = {
  pt: 'Organizando tudo pra você...',
  en: 'Setting everything up for you...',
};

export function finishButtonLabel(finishing: boolean, idleLabel: string, lang: OnboardingLang): string {
  if (!finishing) return idleLabel;
  return FINISHING_COPY[lang] || FINISHING_COPY.pt;
}
