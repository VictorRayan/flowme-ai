import { isAcceptProposalIntent } from '@/lib/onboarding/accept-intent';

describe('isAcceptProposalIntent', () => {
  it('matches common short acceptance phrases', () => {
    [
      'aceitar',
      'aceitar proposta',
      'aceito',
      'Aceito!',
      'pode aceitar',
      'vamos aceitar',
      'confirmo',
      'fechado',
      'concordo',
      'accept',
      "let's go",
    ].forEach((phrase) => {
      expect(isAcceptProposalIntent(phrase)).toBe(true);
    });
  });

  it('strips accents before matching', () => {
    expect(isAcceptProposalIntent('Concórdo')).toBe(true);
  });

  it('ignores negations', () => {
    expect(isAcceptProposalIntent('não quero aceitar')).toBe(false);
    expect(isAcceptProposalIntent('ainda nao')).toBe(false);
  });

  it('ignores long or unrelated messages', () => {
    [
      'preciso pensar antes de aceitar isso com calma agora',
      'quero ganhar 5kg de músculo',
      'me explica melhor essa parte',
      '',
      '   ',
    ].forEach((phrase) => {
      expect(isAcceptProposalIntent(phrase)).toBe(false);
    });
  });
});
