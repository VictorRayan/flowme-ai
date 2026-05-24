import { finishButtonLabel, proposalButtonLabel } from '@/lib/onboarding/proposal-button';

describe('proposalButtonLabel', () => {
  it('uses "Começar minha jornada" when there is a single goal', () => {
    expect(proposalButtonLabel(1, 1, 'pt')).toBe('Começar minha jornada');
  });

  it('uses "Start my journey" when there is a single goal in English', () => {
    expect(proposalButtonLabel(1, 1, 'en')).toBe('Start my journey');
  });

  it('uses "Definir próximo objetivo" between goals when more remain', () => {
    expect(proposalButtonLabel(1, 2, 'pt')).toBe('Definir próximo objetivo');
    expect(proposalButtonLabel(2, 3, 'pt')).toBe('Definir próximo objetivo');
  });

  it('uses "Define next goal" between goals in English', () => {
    expect(proposalButtonLabel(1, 2, 'en')).toBe('Define next goal');
  });

  it('uses the finish label on the last goal', () => {
    expect(proposalButtonLabel(2, 2, 'pt')).toBe('Começar minha jornada');
    expect(proposalButtonLabel(3, 3, 'pt')).toBe('Começar minha jornada');
    expect(proposalButtonLabel(2, 2, 'en')).toBe('Start my journey');
  });

  it('treats invalid counts as a single-goal flow', () => {
    expect(proposalButtonLabel(1, 0, 'pt')).toBe('Começar minha jornada');
    expect(proposalButtonLabel(0, 0, 'en')).toBe('Start my journey');
  });
});

describe('finishButtonLabel', () => {
  it('returns the idle label when not finishing', () => {
    expect(finishButtonLabel(false, 'Começar minha jornada', 'pt')).toBe('Começar minha jornada');
    expect(finishButtonLabel(false, 'Start my journey', 'en')).toBe('Start my journey');
  });

  it('swaps in a localized finishing label while persisting', () => {
    expect(finishButtonLabel(true, 'Começar minha jornada', 'pt')).toBe('Organizando tudo pra você...');
    expect(finishButtonLabel(true, 'Start my journey', 'en')).toBe('Setting everything up for you...');
  });
});
