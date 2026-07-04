'use client';

import { Box, Button, Container, Divider, Stack, Typography } from '@mui/material';
import Image from 'next/image';

const sections = [
  {
    title: 'Dados que coletamos',
    body: 'Coletamos dados de cadastro, contato, assinatura, uso do produto e informações que você decide enviar ao Balys, como mensagens, lembretes, tarefas, finanças, documentos e integrações conectadas.',
  },
  {
    title: 'Como usamos os dados',
    body: 'Usamos os dados para operar sua conta, responder comandos, manter histórico útil, entregar lembretes, processar pagamentos, melhorar segurança, oferecer suporte e cumprir obrigações legais.',
  },
  {
    title: 'Integrações',
    body: 'Quando você conecta Agenda, Slack, Drive, Sheets ou outras fontes, o Flow Me usa os dados autorizados apenas para executar o que você pede e manter o contexto necessário. IDs técnicos e tokens não são exibidos para usuários finais.',
  },
  {
    title: 'Pagamentos',
    body: 'Dados de cartão não são armazenados pela Flow Me. Dados fiscais usados em Pix ou checkout são enviados ao provedor de pagamento quando necessários para processar a cobrança.',
  },
  {
    title: 'Segurança e LGPD',
    body: 'Aplicamos controles de acesso, criptografia em trânsito, políticas internas de mínimo acesso e práticas compatíveis com a LGPD. Você pode solicitar acesso, correção ou exclusão de dados quando aplicável.',
  },
  {
    title: 'Contato',
    body: 'Para dúvidas sobre privacidade, suporte ou dados pessoais, fale com a equipe Flow Me pelos canais oficiais do produto.',
  },
];

export default function PrivacyPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#050609', color: '#f8fafc', py: { xs: 4, md: 7 } }}>
      <Container maxWidth="md">
        <Stack spacing={4}>
          <Button href="/" sx={{ alignSelf: 'flex-start', color: '#cbd5e1', fontWeight: 900 }}>
            Voltar
          </Button>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Image src="/brand/flowme-icon.png" alt="Flow Me" width={44} height={44} />
              <Typography sx={{ fontWeight: 950, fontSize: 28 }}>Flow Me</Typography>
            </Stack>
            <Typography component="h1" sx={{ fontWeight: 950, fontSize: { xs: 38, md: 58 }, lineHeight: 1 }}>
              Política de privacidade
            </Typography>
            <Typography sx={{ color: '#a1a1aa', fontSize: 18, lineHeight: 1.7 }}>
              Esta política explica, em linguagem simples, como a Flow Me trata dados para entregar Balys AI,
              WhatsApp, painel, lembretes, checklists, finanças e integrações.
            </Typography>
          </Stack>
          <Divider sx={{ borderColor: 'rgba(148,163,184,0.18)' }} />
          <Stack spacing={3}>
            {sections.map((section) => (
              <Box key={section.title}>
                <Typography component="h2" sx={{ fontWeight: 950, fontSize: 24, mb: 1 }}>
                  {section.title}
                </Typography>
                <Typography sx={{ color: '#cbd5e1', fontSize: 17, lineHeight: 1.7 }}>{section.body}</Typography>
              </Box>
            ))}
          </Stack>
          <Divider sx={{ borderColor: 'rgba(148,163,184,0.18)' }} />
          <Typography sx={{ color: '#71717a', fontWeight: 700 }}>
            © 2026 Flow Me. CNPJ: 49.858.359/0001-93. Rayan Barbieri Consultoria em Tecnologia.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
