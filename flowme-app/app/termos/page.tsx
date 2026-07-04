'use client';

import { Box, Button, Container, Divider, Stack, Typography } from '@mui/material';
import Image from 'next/image';

const sections = [
  {
    title: 'Uso do Flow Me',
    body: 'O Flow Me organiza rotina, WhatsApp, agenda, checklists, finanças, documentos e integrações com apoio de inteligência artificial. Você é responsável pelas informações que envia e pelas decisões tomadas a partir das respostas.',
  },
  {
    title: 'Balys AI',
    body: 'O Balys ajuda a registrar, consultar e organizar informações. Respostas de IA podem conter erros, então ações críticas devem ser conferidas antes de execução, especialmente em finanças, agenda e documentos importantes.',
  },
  {
    title: 'Conta e acesso',
    body: 'Você deve manter seu acesso protegido e não compartilhar códigos, tokens ou senhas. Integrações externas dependem das permissões concedidas por você e podem ser desconectadas a qualquer momento.',
  },
  {
    title: 'Assinatura',
    body: 'Planos pagos liberam recursos conforme a oferta vigente no checkout. Cobranças, renovação, cancelamento e reembolso seguem as condições apresentadas no momento da assinatura e as regras do provedor de pagamento.',
  },
  {
    title: 'Uso aceitável',
    body: 'Não use o Flow Me para atividades ilegais, abusivas, invasivas, envio de spam, violação de direitos de terceiros ou tentativa de acessar sistemas sem autorização.',
  },
  {
    title: 'Alterações',
    body: 'Podemos atualizar estes termos para refletir mudanças no produto, requisitos legais ou melhorias operacionais. A versão publicada nesta página é a referência atual.',
  },
];

export default function TermsPage() {
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
              Termos de uso
            </Typography>
            <Typography sx={{ color: '#a1a1aa', fontSize: 18, lineHeight: 1.7 }}>
              Estes termos resumem as regras para usar o Flow Me, o Balys AI e as integrações conectadas ao produto.
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
