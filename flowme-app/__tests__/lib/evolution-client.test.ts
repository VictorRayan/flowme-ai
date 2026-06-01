import { verificationCodeMessage } from '@/lib/whatsapp/evolution-client';

describe('WhatsApp verification messages', () => {
  it('renders the verification code in Portuguese', () => {
    expect(verificationCodeMessage('825559', 'pt')).toBe(
      'Seu código de verificação do Flowme / Balys é: *825559*\n\nEle expira em 10 minutos.',
    );
  });

  it('renders the verification code in English', () => {
    expect(verificationCodeMessage('825559', 'en')).toBe(
      'Your Flowme / Balys verification code is: *825559*\n\nIt expires in 10 minutes.',
    );
  });
});
