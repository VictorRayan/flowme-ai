'use client';

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AddIcon from '@mui/icons-material/Add';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChecklistIcon from '@mui/icons-material/Checklist';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import GroupsIcon from '@mui/icons-material/Groups';
import InsightsIcon from '@mui/icons-material/Insights';
import InsertEmoticonIcon from '@mui/icons-material/InsertEmoticon';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import LocalPhoneOutlinedIcon from '@mui/icons-material/LocalPhoneOutlined';
import MicNoneIcon from '@mui/icons-material/MicNone';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  SvgIcon,
  TextField,
  type SvgIconProps,
  Typography,
} from '@mui/material';
import Image from 'next/image';
import { type FormEvent, useState } from 'react';
import BalysIcon from '@/components/brand/BalysIcon';
import GoogleDocsBrandIcon from '@/components/icons/GoogleDocsBrandIcon';
import GoogleDriveBrandIcon from '@/components/icons/GoogleDriveBrandIcon';
import GoogleSheetsBrandIcon from '@/components/icons/GoogleSheetsBrandIcon';
import SlackBrandIcon from '@/components/icons/SlackBrandIcon';
import { formatInternationalPhoneInput, parseInternationalPhone } from '@/lib/whatsapp/phone-number';

const navItems = [
  { label: 'Conselho', href: '#conselho' },
  { label: 'WhatsApp', href: '#whatsapp' },
  { label: 'Lembretes', href: '#lembretes' },
  { label: 'Checklists', href: '#checklists' },
  { label: 'Finanças', href: '#financas' },
  { label: 'Integrações', href: '#integracoes' },
  { label: 'Planos', href: '#planos' },
];

function SlackWhiteIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="70 70 130 130">
      <path d="M99.4 151.2c0 7.1-5.8 12.9-12.9 12.9-7.1 0-12.9-5.8-12.9-12.9 0-7.1 5.8-12.9 12.9-12.9h12.9v12.9zM105.9 151.2c0-7.1 5.8-12.9 12.9-12.9 7.1 0 12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9-7.1 0-12.9-5.8-12.9-12.9v-32.3z" fill="currentColor" />
      <path d="M118.8 99.4c-7.1 0-12.9-5.8-12.9-12.9 0-7.1 5.8-12.9 12.9-12.9 7.1 0 12.9 5.8 12.9 12.9v12.9h-12.9zM118.8 105.9c7.1 0 12.9 5.8 12.9 12.9 0 7.1-5.8 12.9-12.9 12.9H86.5c-7.1 0-12.9-5.8-12.9-12.9 0-7.1 5.8-12.9 12.9-12.9h32.3z" fill="currentColor" />
      <path d="M170.6 118.8c0-7.1 5.8-12.9 12.9-12.9 7.1 0 12.9 5.8 12.9 12.9 0 7.1-5.8 12.9-12.9 12.9h-12.9v-12.9zM164.1 118.8c0 7.1-5.8 12.9-12.9 12.9-7.1 0-12.9-5.8-12.9-12.9V86.5c0-7.1 5.8-12.9 12.9-12.9 7.1 0 12.9 5.8 12.9 12.9v32.3z" fill="currentColor" />
      <path d="M151.2 170.6c7.1 0 12.9 5.8 12.9 12.9 0 7.1-5.8 12.9-12.9 12.9-7.1 0-12.9-5.8-12.9-12.9v-12.9h12.9zM151.2 164.1c-7.1 0-12.9-5.8-12.9-12.9 0-7.1 5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9 0 7.1-5.8 12.9-12.9 12.9h-32.3z" fill="currentColor" />
    </SvgIcon>
  );
}

function GoogleDriveWhiteIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 87.3 78">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="currentColor" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="currentColor" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="currentColor" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="currentColor" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="currentColor" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="currentColor" />
    </SvgIcon>
  );
}

function GoogleSheetsWhiteIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 47 65">
      <path d="M29.375 0H3.125C1.425 0 .017 1.408.017 3.135L0 61.865C0 63.593 1.394 65 3.123 65h40.6c1.728 0 3.142-1.407 3.142-3.135V15.643z" fill="currentColor" />
      <path d="M46.864 15.643l-13.139.014c-1.731 0-3.139-1.408-3.139-3.139L30.6 0z" fill="currentColor" opacity="0.7" />
      <path d="M12.35 28.6v18.85h22.3V28.6zm9.75 16.575h-7.475V40.3h7.475zm0-7.15h-7.475v-4.875h7.475zm10.275 7.15h-8V40.3h8zm0-7.15h-8v-4.875h8z" fill="#050609" opacity="0.72" />
    </SvgIcon>
  );
}

const proofPoints = [
  { label: '10 mil usuários ativos', icon: GroupsIcon },
  { label: '99,9% de precisão na IA', icon: QueryStatsIcon },
  { label: 'Grupo Rayan Barbieri Tecnologia', icon: InsightsIcon },
  { label: 'Conselho de especialistas', icon: AutoAwesomeIcon },
  { label: 'Integração com Agenda', icon: CalendarMonthIcon },
  { label: 'Integração com Slack', icon: SlackWhiteIcon },
  { label: 'Integração com Drive', icon: GoogleDriveWhiteIcon },
  { label: 'Integração com Sheets', icon: GoogleSheetsWhiteIcon },
  { label: 'LGPD', icon: ShieldOutlinedIcon },
];

const features = [
  {
    id: 'conselho',
    eyebrow: 'Conselho de especialistas',
    title: 'Decisões com especialistas simulados por inteligência artificial.',
    body: 'Balys convoca um conselho premium de especialistas de IA para analisar risco, prioridade, impacto e próximo passo sem transformar sua rotina em um relatório gigante.',
    icon: AutoAwesomeIcon,
    bullets: ['Prioridade clara para hoje', 'Risco e oportunidade lado a lado', 'Recomendação executiva e acionável'],
  },
  {
    id: 'lembretes',
    eyebrow: 'Lembretes',
    title: 'A rotina volta para a conversa certa, na hora certa.',
    body: 'Crie lembretes por texto ou áudio, sincronize com agenda e receba o empurrão necessário pelo WhatsApp.',
    icon: NotificationsActiveIcon,
    bullets: ['Lembretes por WhatsApp', 'Agenda sempre espelhada', 'Resumo do dia sem fricção'],
  },
  {
    id: 'checklists',
    eyebrow: 'Checklists',
    title: 'Planos quebrados em passos que cabem no dia.',
    body: 'Projetos, compras, viagens e rotinas viram listas práticas, com progresso claro e próximos passos visíveis.',
    icon: ChecklistIcon,
    bullets: ['Itens criados por voz', 'Progresso por contexto', 'Execução sem perder detalhes'],
  },
  {
    id: 'financas',
    eyebrow: 'Finanças',
    title: 'Gastos e receitas registrados do jeito que você fala.',
    body: 'Diga “gastei R$100 no mercado” e o Balys registra, categoriza e mantém seu painel pronto para consulta.',
    icon: CreditCardIcon,
    bullets: ['Lançamentos por WhatsApp', 'Categorias automáticas', 'Resumo financeiro consultável'],
  },
];

const integrations = [
  { label: 'Google Agenda', icon: CalendarMonthIcon },
  { label: 'Slack', icon: SlackBrandIcon },
  { label: 'Google Drive', icon: GoogleDriveBrandIcon },
  { label: 'Google Sheets', icon: GoogleSheetsBrandIcon },
];

const singularityItems = [
  { label: 'WhatsApp', icon: WhatsAppIcon, x: 50, y: 6, color: '#25d366' },
  { label: 'Slack', icon: SlackBrandIcon, x: 80, y: 16, color: '#e2e8f0' },
  { label: 'Drive', icon: GoogleDriveBrandIcon, x: 94, y: 43, color: '#e2e8f0' },
  { label: 'Docs', icon: GoogleDocsBrandIcon, x: 85, y: 72, color: '#e2e8f0' },
  { label: 'Sheets', icon: GoogleSheetsBrandIcon, x: 61, y: 90, color: '#e2e8f0' },
  { label: 'Banco', icon: AccountBalanceWalletOutlinedIcon, x: 36, y: 90, color: '#22c55e' },
  { label: 'Documentos', icon: InsertDriveFileOutlinedIcon, x: 12, y: 72, color: '#38bdf8' },
  { label: 'Reuniões', icon: GroupsIcon, x: 5, y: 43, color: '#a78bfa' },
  { label: 'Calendar', icon: CalendarMonthIcon, x: 18, y: 16, color: '#f97316' },
  { label: 'Checklist', icon: ChecklistIcon, x: 32, y: 4, color: '#22d3ee' },
  { label: 'Metas', icon: FlagOutlinedIcon, x: 68, y: 4, color: '#facc15' },
  { label: 'Files', icon: DescriptionOutlinedIcon, x: 8, y: 24, color: '#e2e8f0' },
  { label: 'Notas', icon: ArticleOutlinedIcon, x: 92, y: 24, color: '#e2e8f0' },
];

const plans = [
  {
    title: 'Mensal',
    price: 'R$59,90',
    cadence: '/mês',
    description: 'Para desbloquear agora e testar o Flow Me completo sem compromisso anual.',
    interval: 'monthly' as const,
    badge: 'Flexível',
    highlights: ['Balys AI ilimitado', 'WhatsApp, lembretes e checklists', 'Finanças e integrações'],
  },
  {
    title: 'Anual',
    price: 'R$39,90',
    cadence: '/mês',
    description: 'R$478,80 por ano. Melhor preço para usar o Balys como sistema operacional da rotina.',
    interval: 'annual' as const,
    badge: 'Melhor preço',
    highlights: ['Economia de R$240 no ano', 'Tudo do plano mensal', 'Prioridade para recursos novos'],
  },
];
type Plan = typeof plans[number];

const planFeatureRows = [
  { label: 'Balys AI ilimitado', monthly: true, annual: true },
  { label: 'IA no WhatsApp', monthly: true, annual: true },
  { label: 'Lembretes e checklists', monthly: true, annual: true },
  { label: 'Finanças por conversa', monthly: true, annual: true },
  { label: 'Integrações com Agenda, Slack, Drive e Sheets', monthly: true, annual: true },
  { label: 'Conselho de especialistas por inteligência artificial', monthly: true, annual: true },
  { label: 'Painel completo no computador e celular', monthly: true, annual: true },
  { label: 'Prioridade em recursos novos', monthly: false, annual: true },
  { label: 'Economia de R$240 no ano', monthly: false, annual: true },
  { label: 'Melhor preço para operar a rotina inteira', monthly: false, annual: true },
];

const footerProducts = ['Conselho', 'WhatsApp', 'Lembretes', 'Checklists', 'Finanças', 'Integrações', 'Planos'];
const footerProof = ['IA no WhatsApp', 'LGPD', 'Grupo Rayan Barbieri Tecnologia'];
type BillingInterval = 'monthly' | 'annual';

const phoneCountries = [
  { code: 'BR', flag: '🇧🇷', dialCode: '+55', label: 'Brasil' },
  { code: 'US', flag: '🇺🇸', dialCode: '+1', label: 'Estados Unidos' },
  { code: 'PT', flag: '🇵🇹', dialCode: '+351', label: 'Portugal' },
  { code: 'GB', flag: '🇬🇧', dialCode: '+44', label: 'Reino Unido' },
  { code: 'ES', flag: '🇪🇸', dialCode: '+34', label: 'Espanha' },
  { code: 'FR', flag: '🇫🇷', dialCode: '+33', label: 'França' },
  { code: 'IT', flag: '🇮🇹', dialCode: '+39', label: 'Itália' },
] as const;

type PhoneCountry = typeof phoneCountries[number];

type LeadFormState = {
  name: string;
  email: string;
  phone: string;
};

const emptyLeadForm: LeadFormState = {
  name: '',
  email: '',
  phone: '',
};

const leadStorageKey = 'flowme_lp_lead_pt-br';
const priceUnlockedStorageKey = 'flowme_lp_price_unlocked_pt-br';
const leadTextFieldSx = {
  '& .MuiInputLabel-root': { color: '#cbd5e1', fontWeight: 800 },
  '& .MuiInputLabel-root.Mui-focused': { color: '#35dc9b' },
  '& .MuiOutlinedInput-root': {
    color: '#f8fafc',
    bgcolor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    '& fieldset': { borderColor: 'rgba(226,232,240,0.2)' },
    '&:hover fieldset': { borderColor: 'rgba(53,220,155,0.45)' },
    '&.Mui-focused fieldset': { borderColor: '#35dc9b' },
  },
  '& .MuiFormHelperText-root': { color: '#fca5a5', fontWeight: 700, ml: 0 },
};

function browserId(storage: Storage, key: string) {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  storage.setItem(key, id);
  return id;
}

function formatBrazilPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatNationalPhoneInput(value: string, country: PhoneCountry) {
  const digits = value.replace(/\D/g, '');
  if (country.code === 'BR') return formatBrazilPhone(digits);
  const formatted = formatInternationalPhoneInput(`${country.dialCode}${digits}`);
  return formatted.startsWith(country.dialCode) ? formatted.slice(country.dialCode.length).trim() : digits;
}

function internationalLeadPhone(form: LeadFormState, country: PhoneCountry) {
  const digits = form.phone.replace(/\D/g, '');
  return `${country.dialCode}${digits}`;
}

function validateLeadForm(form: LeadFormState, country: PhoneCountry) {
  const errors: Partial<Record<keyof LeadFormState, string>> = {};
  const parsedPhone = parseInternationalPhone(internationalLeadPhone(form, country));
  if (form.name.trim().length < 2) errors.name = 'Informe seu nome.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Informe um email válido.';
  if (!parsedPhone) errors.phone = 'Informe um telefone válido.';
  return errors;
}

async function fetchMarketingCsrf() {
  const response = await fetch('/api/marketing/csrf', { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok || !payload.ok || !payload.token) throw new Error('csrf');
  return String(payload.token);
}

function checkoutHref(lead: { lead_token: string; email: string; interval: BillingInterval }) {
  const url = new URL('/checkout', window.location.origin);
  url.searchParams.set('locale', 'pt-BR');
  url.searchParams.set('source', 'lp_pt-br');
  url.searchParams.set('lead_token', lead.lead_token);
  url.searchParams.set('email', lead.email);
  url.searchParams.set('interval', lead.interval);
  return url.toString();
}

function ProofMarquee() {
  const repeated = [...proofPoints, ...proofPoints];

  return (
    <Box
      sx={{
        overflow: 'hidden',
        borderBlock: '1px solid rgba(148,163,184,0.12)',
        bgcolor: '#050609',
        background:
          'radial-gradient(circle at 20% 20%, rgba(249,115,22,0.12), transparent 28%), radial-gradient(circle at 76% 24%, rgba(34,211,238,0.12), transparent 28%), #050609',
        backdropFilter: 'blur(18px)',
        '@keyframes proofScroll': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      }}
    >
      <Stack
        direction="row"
        sx={{
          width: 'max-content',
          animation: 'proofScroll 28s linear infinite',
          py: 1.5,
          '&:hover': { animationPlayState: 'paused' },
        }}
      >
        {repeated.map((point, index) => {
          const Icon = point.icon;

          return (
            <Stack
              key={`${point.label}-${index}`}
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ px: { xs: 2, md: 3 }, color: '#f8fafc', whiteSpace: 'nowrap' }}
            >
              <Box
                sx={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 28,
                  height: 28,
                  color: '#fff',
                  filter: 'drop-shadow(0 10px 18px rgba(249,115,22,0.3))',
                }}
              >
                <Icon sx={{ fontSize: 22, strokeWidth: 1.6 }} />
              </Box>
              <Typography fontWeight={850} sx={{ color: '#e2e8f0', fontSize: { xs: 14, md: 15 } }}>
                {point.label}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

function TypingDots() {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ height: 22 }}>
      {[0, 1, 2].map((dot) => (
        <Box
          key={dot}
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: '#87929a',
            animation: 'typingPulse 1s ease-in-out infinite',
            animationDelay: `${dot * 0.16}s`,
          }}
        />
      ))}
    </Stack>
  );
}

function MessageBubble({
  children,
  side = 'left',
  delay = 0,
  typing = false,
}: {
  children?: React.ReactNode;
  side?: 'left' | 'right';
  delay?: number;
  typing?: boolean;
}) {
  const outgoing = side === 'right';
  const cycleSeconds = 35;
  const start = Math.min(84, Math.max(0, (delay / cycleSeconds) * 100));
  const visible = typing ? 7 : 82 - start;
  const enter = Math.min(96, start + 2);
  const hold = Math.min(96, start + visible);
  const exit = Math.min(98, hold + 2);
  const animationName = `${typing ? 'typingBubbleCycle' : 'messageCycle'}${Math.round(delay * 10)}`;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: outgoing ? 'flex-end' : 'flex-start',
        opacity: 0,
        transform: 'translateY(10px)',
        animation: `${animationName} ${cycleSeconds}s linear infinite`,
        [`@keyframes ${animationName}`]: {
          '0%': { opacity: 0, transform: 'translateY(10px)' },
          [`${start}%`]: { opacity: 0, transform: 'translateY(10px)' },
          [`${enter}%`]: { opacity: 1, transform: 'translateY(0)' },
          [`${hold}%`]: { opacity: 1, transform: 'translateY(0)' },
          [`${exit}%`]: { opacity: 0, transform: 'translateY(0)' },
          '100%': { opacity: 0, transform: 'translateY(10px)' },
        },
      }}
    >
      <Box
        sx={{
          maxWidth: outgoing ? '82%' : '86%',
          px: 1.5,
          py: 1,
          borderRadius: outgoing ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          bgcolor: outgoing ? '#d9fdd3' : '#fff',
          color: '#111b21',
          boxShadow: '0 1px 1px rgba(17,27,33,0.12)',
          fontSize: 13.5,
          lineHeight: 1.45,
          minWidth: typing ? 72 : 'auto',
        }}
      >
        {typing ? <TypingDots /> : children}
        {!typing && (
          <Typography component="span" sx={{ ml: 1, color: '#667781', fontSize: 11, float: 'right', pt: 0.5 }}>
            09:{outgoing ? '41' : '42'}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function WhatsAppIphone() {
  return (
    <Box
      id="whatsapp"
      sx={{
        mx: 'auto',
        width: 'min(100%, 318px)',
        aspectRatio: '9 / 18.5',
        position: 'relative',
        borderRadius: '42px',
        p: 1.2,
        bgcolor: '#101319',
        border: '1px solid rgba(255,255,255,0.2)',
        boxShadow: '0 34px 80px rgba(17,24,39,0.28), inset 0 0 0 2px rgba(255,255,255,0.12), inset 0 0 0 8px #20242d',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: -5,
          top: '19%',
          width: 4,
          height: 58,
          borderRadius: '6px 0 0 6px',
          background: 'linear-gradient(180deg, #252a35, #111827)',
          boxShadow: '0 76px 0 #171c26',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          right: -5,
          top: '28%',
          width: 4,
          height: 82,
          borderRadius: '0 6px 6px 0',
          background: 'linear-gradient(180deg, #252a35, #111827)',
        },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          top: 14,
          left: '50%',
          zIndex: 4,
          transform: 'translateX(-50%)',
          width: 112,
          height: 30,
          borderRadius: 999,
          bgcolor: '#050609',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.12), 0 2px 8px rgba(0,0,0,0.35)',
          '&::after': {
            content: '""',
            position: 'absolute',
            right: 11,
            top: '50%',
            width: 8,
            height: 8,
            borderRadius: '50%',
            transform: 'translateY(-50%)',
            bgcolor: '#151a24',
            border: '1px solid rgba(90,111,148,0.45)',
          },
        }}
      />
      <Box
        sx={{
          height: '100%',
          overflow: 'hidden',
          borderRadius: '34px',
          bgcolor: '#efe7dd',
          position: 'relative',
          '@keyframes messageCycle': {
            '0%, 2%': { opacity: 0, transform: 'translateY(10px)' },
            '4%, 88%': { opacity: 1, transform: 'translateY(0)' },
            '92%, 100%': { opacity: 0, transform: 'translateY(0)' },
          },
          '@keyframes typingBubbleCycle': {
            '0%, 3%': { opacity: 0, transform: 'translateY(10px)' },
            '5%, 15%': { opacity: 1, transform: 'translateY(0)' },
            '18%, 100%': { opacity: 0, transform: 'translateY(0)' },
          },
          '@keyframes typingPulse': {
            '0%, 100%': { opacity: 0.35, transform: 'translateY(0)' },
            '50%': { opacity: 1, transform: 'translateY(-3px)' },
          },
          '@keyframes chatScrollCycle': {
            '0%, 8%': { transform: 'translateY(0)' },
            '20%, 32%': { transform: 'translateY(-96px)' },
            '44%, 80%': { transform: 'translateY(-222px)' },
            '90%, 100%': { transform: 'translateY(0)' },
          },
        }}
      >
        <Box
          sx={{
            height: 38,
            bgcolor: '#f7faf8',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            color: '#111827',
            px: 2.2,
            pt: 0.5,
            fontSize: 14,
            fontWeight: 800,
            position: 'relative',
            zIndex: 3,
          }}
        >
          <Typography sx={{ color: '#050609', fontWeight: 950, fontSize: 14 }}>17:13</Typography>
          <Box />
          <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.75}>
            <Stack direction="row" alignItems="end" spacing={0.18} aria-hidden="true">
              {[6, 9, 12, 15].map((height) => (
                <Box key={height} sx={{ width: 2.4, height, borderRadius: 1, bgcolor: '#050609' }} />
              ))}
            </Stack>
            <Box aria-hidden="true" sx={{ position: 'relative', width: 17, height: 12 }}>
              <Box sx={{ position: 'absolute', left: 1, top: 1, width: 15, height: 15, border: '2px solid #050609', borderColor: '#050609 transparent transparent transparent', borderRadius: '50%', transform: 'rotate(45deg)' }} />
              <Box sx={{ position: 'absolute', left: 6.6, top: 7, width: 4, height: 4, borderRadius: '50%', bgcolor: '#050609' }} />
            </Box>
            <Box aria-hidden="true" sx={{ width: 24, height: 12, border: '1.8px solid #050609', borderRadius: 0.8, position: 'relative', '&::before': { content: '""', position: 'absolute', left: 2, top: 2, bottom: 2, width: 16, borderRadius: 0.45, bgcolor: '#050609' }, '&::after': { content: '""', position: 'absolute', right: -4, top: 3.2, width: 2.2, height: 5.5, borderRadius: '0 2px 2px 0', bgcolor: '#050609' } }} />
          </Stack>
        </Box>
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.75}
          sx={{
            px: 1.15,
            py: 1.15,
            bgcolor: '#f0f2f5',
            borderBottom: '1px solid rgba(17,27,33,0.08)',
            position: 'relative',
            zIndex: 3,
          }}
        >
          <ArrowBackIosNewIcon sx={{ color: '#0b84ff', fontSize: 18, flexShrink: 0 }} />
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              bgcolor: '#fff',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 1px 6px rgba(17,27,33,0.08)',
              flexShrink: 0,
            }}
          >
            <Image src="/brand/flowme-icon.png" alt="Flow Me" width={26} height={26} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={0.55} alignItems="center" sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ color: '#111b21', fontWeight: 950, fontSize: 12.1, minWidth: 0 }}>
                Flow Me - Balys AI
              </Typography>
              <Box
                aria-hidden="true"
                sx={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 13,
                  height: 13,
                  borderRadius: '50%',
                  bgcolor: '#4bb3f4',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 950,
                  flexShrink: 0,
                }}
              >
                ✓
              </Box>
            </Stack>
            <Typography sx={{ color: '#667781', fontWeight: 760, fontSize: 12 }}>
              online agora
            </Typography>
          </Box>
          <VideocamOutlinedIcon sx={{ color: '#0b84ff', fontSize: 20, flexShrink: 0 }} />
          <LocalPhoneOutlinedIcon sx={{ color: '#0b84ff', fontSize: 20, flexShrink: 0 }} />
        </Stack>
        <Box
          sx={{
            position: 'absolute',
            inset: '88px 0 58px',
            overflow: 'hidden',
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(99,102,241,0.08) 0 2px, transparent 3px), radial-gradient(circle at 70% 45%, rgba(34,211,238,0.1) 0 2px, transparent 3px)',
            backgroundSize: '34px 34px',
            zIndex: 1,
          }}
        >
          <Stack
            data-chat-scroll="true"
            spacing={1}
            sx={{
              p: 1.4,
              minHeight: 700,
              animation: 'chatScrollCycle 35s linear infinite',
              willChange: 'transform',
            }}
          >
            <MessageBubble side="right" delay={0.05}>
              Balys, quais reuniões e tarefas eu deveria focar hoje?
            </MessageBubble>
            <MessageBubble typing delay={0.35} />
            <MessageBubble delay={0.78}>
              Hoje você tem call de proposta às 15h. Revise preço, risco e próximo passo antes das 14h30.
            </MessageBubble>
            <MessageBubble side="right" delay={1.35}>
              Registra R$100 de mercado e cria checklist da viagem.
            </MessageBubble>
            <MessageBubble typing delay={1.7} />
            <MessageBubble delay={2.1}>
              Feito. Registrei R$100 em supermercado e criei um checklist com documentos, mala, transporte e reservas.
            </MessageBubble>
            <MessageBubble side="right" delay={2.62}>
              E meu treino?
            </MessageBubble>
            <MessageBubble typing delay={2.92} />
            <MessageBubble delay={3.35}>
              Está marcado para terça às 8h. Ativei um lembrete no WhatsApp 45 minutos antes.
            </MessageBubble>
            <MessageBubble side="right" delay={4.15}>
              Me lembra hoje às 18h de tomar creatina e separar a roupa do treino.
            </MessageBubble>
            <MessageBubble typing delay={4.55} />
            <MessageBubble delay={5.05}>
              Combinado. Criei um lembrete para hoje às 18h e vou te avisar aqui no WhatsApp.
            </MessageBubble>
            <MessageBubble delay={6.2}>
              Lembrete: tomar creatina e separar a roupa do treino agora.
            </MessageBubble>
          </Stack>
        </Box>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            p: 1,
            bgcolor: '#f0f2f5',
            zIndex: 3,
          }}
        >
          <AddIcon sx={{ color: '#8b929c', fontSize: 32, flexShrink: 0 }} />
          <Box
            sx={{
              flex: 1,
              bgcolor: '#fff',
              height: 36,
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              px: 1,
              boxShadow: 'inset 0 0 0 1px rgba(17,27,33,0.04)',
            }}
          >
            <InsertEmoticonIcon sx={{ color: '#8b929c', fontSize: 23 }} />
          </Box>
          <PhotoCameraOutlinedIcon sx={{ color: '#8b929c', fontSize: 29, flexShrink: 0 }} />
          <IconButton aria-label="Gravar áudio" sx={{ color: '#8b929c', width: 34, height: 34 }}>
            <MicNoneIcon sx={{ fontSize: 30 }} />
          </IconButton>
        </Stack>
      </Box>
    </Box>
  );
}

function SingularitySection() {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#050609',
        color: '#f8fafc',
        py: { xs: 5, md: 7 },
        borderBlock: '1px solid rgba(148,163,184,0.12)',
        background:
          'radial-gradient(circle at 50% 48%, rgba(99,102,241,0.22), transparent 28%), radial-gradient(circle at 28% 24%, rgba(167,139,250,0.12), transparent 22%), radial-gradient(circle at 78% 70%, rgba(34,211,238,0.14), transparent 24%), #050609',
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
          <Grid item xs={12} md={5}>
            <Stack spacing={2.2}>
              <Chip
                icon={<BalysIcon />}
                label="Do seu jeito"
                sx={{
                  alignSelf: 'flex-start',
                  bgcolor: 'rgba(255,255,255,0.08)',
                  color: '#e0e7ff',
                  border: '1px solid rgba(167,139,250,0.22)',
                  fontWeight: 950,
                }}
              />
              <Typography component="h2" sx={{ fontWeight: 950, fontSize: { xs: 34, md: 54 }, lineHeight: 1.02 }}>
                Não tem um jeito certo de usar. Tem o seu jeito.
              </Typography>
              <Typography sx={{ color: '#cbd5e1', fontSize: { xs: 17, md: 20 }, lineHeight: 1.65 }}>
                Seja no app ou no WhatsApp, no computador ou no celular, o Flow Me puxa agenda, arquivos,
                reuniões, finanças, checklists, metas e integrações para um centro só.
              </Typography>
            </Stack>
          </Grid>
          <Grid item xs={12} md={7}>
            <Box
              aria-label="Singularidade Flow Me"
              sx={{
                position: 'relative',
                minHeight: { xs: 300, sm: 360, md: 430 },
                '@keyframes orbitSpin': {
                  to: { transform: 'translate(-50%, -50%) rotate(360deg)' },
                },
                '@keyframes centerFlow': {
                  '0%, 45%': { opacity: 1, transform: 'scale(1) rotate(0deg)' },
                  '50%, 95%': { opacity: 0, transform: 'scale(0.72) rotate(18deg)' },
                  '100%': { opacity: 1, transform: 'scale(1) rotate(0deg)' },
                },
                '@keyframes centerWhats': {
                  '0%, 45%': { opacity: 0, transform: 'scale(0.72) rotate(-18deg)' },
                  '50%, 95%': { opacity: 1, transform: 'scale(1) rotate(0deg)' },
                  '100%': { opacity: 0, transform: 'scale(0.72) rotate(-18deg)' },
                },
                '@keyframes corePulse': {
                  '0%, 100%': { boxShadow: '0 0 0 0 rgba(99,102,241,0.28), 0 0 80px rgba(99,102,241,0.36)' },
                  '50%': { boxShadow: '0 0 0 18px rgba(99,102,241,0), 0 0 120px rgba(34,211,238,0.34)' },
                },
                '@keyframes lensBreath': {
                  '0%, 100%': { opacity: 0.72, transform: 'translate(-50%, -50%) rotate(-2deg) scaleX(1)' },
                  '50%': { opacity: 0.96, transform: 'translate(-50%, -50%) rotate(1deg) scaleX(1.06)' },
                },
              }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  position: 'absolute',
                  left: '50%',
                  top: '53%',
                  width: { xs: '84%', md: '92%' },
                  height: { xs: 46, md: 70 },
                  borderRadius: '50%',
                  transform: 'translate(-50%, -50%) rotate(-1deg)',
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.18) 18%, rgba(255,255,255,0.82) 42%, rgba(255,255,255,0.96) 50%, rgba(255,255,255,0.78) 58%, rgba(99,102,241,0.18) 82%, transparent 100%)',
                  filter: 'blur(10px)',
                  mixBlendMode: 'screen',
                  animation: 'lensBreath 4.8s ease-in-out infinite',
                  zIndex: 1,
                }}
              />
              <Box
                aria-hidden="true"
                sx={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: { xs: 154, md: 218 },
                  height: { xs: 154, md: 218 },
                  borderRadius: '50%',
                  transform: 'translate(-50%, -50%)',
                  background:
                    'radial-gradient(circle, #020305 0 44%, rgba(5,6,9,0.92) 45% 52%, rgba(255,255,255,0.64) 53% 55%, rgba(129,140,248,0.34) 58%, transparent 72%)',
                  boxShadow:
                    '0 0 46px rgba(255,255,255,0.32), 0 0 90px rgba(129,140,248,0.28), inset 0 0 30px rgba(0,0,0,0.95)',
                  zIndex: 2,
                }}
              />
              <Box
                aria-hidden="true"
                sx={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: { xs: '86%', md: '96%' },
                  height: { xs: 42, md: 62 },
                  borderRadius: '50%',
                  transform: 'translate(-50%, -50%) rotate(-1deg)',
                  background:
                    'linear-gradient(90deg, transparent, rgba(167,139,250,0.2) 18%, rgba(255,255,255,0.84) 45%, rgba(255,255,255,0.94) 50%, rgba(255,255,255,0.8) 55%, rgba(167,139,250,0.18) 82%, transparent)',
                  filter: 'blur(5px)',
                  mixBlendMode: 'screen',
                  zIndex: 3,
                }}
              />
              {[0, 1, 2].map((ring) => (
                <Box
                  key={ring}
                  aria-hidden="true"
                  sx={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: `${34 + ring * 22}%`,
                    aspectRatio: '1',
                    borderRadius: '50%',
                    border: '1px solid rgba(148,163,184,0.16)',
                    transform: 'translate(-50%, -50%)',
                    animation: `orbitSpin ${22 + ring * 9}s linear infinite`,
                    opacity: 0.9 - ring * 0.18,
                    zIndex: 2,
                  }}
                />
              ))}
              {singularityItems.map((item, index) => {
                const dx = item.x - 50;
                const dy = item.y - 50;
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                const length = Math.sqrt(dx * dx + dy * dy) * 1.15;
                const lineAnimation = `spiralLine${index}`;

                return (
                  <Box
                    key={`${item.label}-line`}
                    aria-hidden="true"
                    sx={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      width: `${length}%`,
                      height: 0.5,
                      borderRadius: 999,
                      transformOrigin: '0 50%',
                      background:
                        'linear-gradient(90deg, rgba(255,255,255,0.2), rgba(129,140,248,0.12), rgba(34,211,238,0))',
                      opacity: 0.22,
                      animation: `${lineAnimation} 7.2s ease-in-out infinite`,
                      animationDelay: `${index * 0.18}s`,
                      zIndex: 1,
                      [`@keyframes ${lineAnimation}`]: {
                        '0%, 100%': { transform: `rotate(${angle}deg) scaleX(1)`, opacity: 0.12 },
                        '45%': { transform: `rotate(${angle + 10}deg) scaleX(0.68)`, opacity: 0.24 },
                        '64%': { transform: `rotate(${angle + 28}deg) scaleX(0.14)`, opacity: 0.08 },
                        '78%': { transform: `rotate(${angle - 5}deg) scaleX(1.05)`, opacity: 0.18 },
                      },
                    }}
                  />
                );
              })}
              {singularityItems.map((item, index) => {
                const Icon = item.icon;
                const moveX = (50 - item.x) * 0.9;
                const moveY = (50 - item.y) * 0.9;
                const nodeAnimation = `spiralNode${index}`;

                return (
                  <Stack
                    key={item.label}
                    spacing={0.7}
                    alignItems="center"
                    sx={{
                      position: 'absolute',
                      left: `${item.x}%`,
                      top: `${item.y}%`,
                      width: { xs: 60, md: 74 },
                      color: '#e2e8f0',
                      animation: `${nodeAnimation} 7.2s ease-in-out infinite`,
                      animationDelay: `${index * 0.18}s`,
                      transformOrigin: '50% 50%',
                      zIndex: 4,
                      [`@keyframes ${nodeAnimation}`]: {
                        '0%, 100%': { transform: 'translate(-50%, -50%) rotate(0deg) scale(1)', opacity: 0.94 },
                        '44%': {
                          transform: `translate(calc(-50% + ${moveX * 0.55}%), calc(-50% + ${moveY * 0.55}%)) rotate(96deg) scale(0.72)`,
                          opacity: 1,
                        },
                        '64%': {
                          transform: `translate(calc(-50% + ${moveX}%), calc(-50% + ${moveY}%)) rotate(210deg) scale(0.24)`,
                          opacity: 0.2,
                        },
                        '78%': { transform: 'translate(-50%, -50%) rotate(328deg) scale(1.05)', opacity: 0.96 },
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'grid',
                        placeItems: 'center',
                        width: { xs: 40, md: 48 },
                        height: { xs: 40, md: 48 },
                        borderRadius: '50%',
                        bgcolor: 'rgba(15,23,42,0.78)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        backdropFilter: 'blur(18px)',
                        boxShadow: '0 18px 40px rgba(0,0,0,0.28)',
                      }}
                    >
                      <Icon sx={{ fontSize: { xs: 22, md: 27 }, color: item.color }} />
                    </Box>
                    <Typography sx={{ color: '#cbd5e1', fontWeight: 850, fontSize: { xs: 10, md: 11.5 }, textAlign: 'center' }}>
                      {item.label}
                    </Typography>
                  </Stack>
                );
              })}
              <Box
                sx={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  display: 'grid',
                  placeItems: 'center',
                  width: { xs: 92, md: 112 },
                  height: { xs: 92, md: 112 },
                  borderRadius: '50%',
                  bgcolor: 'rgba(255,255,255,0.96)',
                  border: '1px solid rgba(255,255,255,0.36)',
                  animation: 'corePulse 3s ease-in-out infinite',
                  zIndex: 5,
                }}
              >
                <Box sx={{ position: 'relative', width: { xs: 54, md: 64 }, height: { xs: 54, md: 64 } }}>
                  <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', animation: 'centerFlow 3s ease-in-out infinite' }}>
                    <Image src="/brand/flowme-icon.png" alt="Flow Me" width={64} height={64} />
                  </Box>
                  <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', animation: 'centerWhats 3s ease-in-out infinite' }}>
                    <WhatsAppIcon sx={{ color: '#25d366', fontSize: { xs: 50, md: 60 } }} />
                  </Box>
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

function PlanCard({ plan, onUnlock }: { plan: Plan; onUnlock: (interval: BillingInterval) => void }) {
  const isAnnual = plan.title === 'Anual';

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        p: { xs: 3, sm: 4, md: 4.5 },
        borderRadius: { xs: '0 0 14px 14px', md: 2.5 },
        color: '#f8fafc',
        background:
          'linear-gradient(135deg, rgba(139,124,255,0.22), transparent 34%), linear-gradient(160deg, rgba(19,27,48,0.98), rgba(8,12,24,0.96))',
        border: isAnnual ? '1px solid rgba(53,220,155,0.74)' : '1px solid rgba(139,124,255,0.34)',
        borderTop: { xs: 0, md: isAnnual ? '1px solid rgba(53,220,155,0.74)' : '1px solid rgba(139,124,255,0.34)' },
        backdropFilter: 'blur(24px)',
        boxShadow: isAnnual
          ? '0 28px 80px rgba(0,0,0,0.38), 0 0 0 4px rgba(53,220,155,0.14), inset 0 0 0 1px rgba(255,255,255,0.06)'
          : '0 24px 70px rgba(0,0,0,0.34), inset 0 0 0 1px rgba(255,255,255,0.04)',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent), radial-gradient(circle at 50% 0%, rgba(53,220,155,0.12), transparent 18rem)',
          opacity: 0.75,
        },
      }}
    >
      <Stack spacing={2.8} alignItems="flex-start" sx={{ position: 'relative', zIndex: 1, height: '100%', textAlign: 'left' }}>
        <Chip
          label={isAnnual ? 'Mais vendido' : plan.badge}
          sx={{
            bgcolor: isAnnual ? '#35dc9b' : 'rgba(255,255,255,0.08)',
            color: isAnnual ? '#07120d' : '#e2e8f0',
            fontWeight: 950,
            px: 0.8,
            '& .MuiChip-label': { px: 1.2 },
          }}
        />
        <Box>
          <Typography sx={{ color: '#f8fafc', fontWeight: 950, fontSize: { xs: 34, md: 38 }, lineHeight: 1 }}>{plan.title}</Typography>
          <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 1.6 }}>
            <Typography
              aria-label={`${plan.title} ${plan.price}`}
              sx={{
                color: '#f8fafc',
                fontWeight: 950,
                fontSize: { xs: 58, sm: 72, md: 76 },
                lineHeight: 0.92,
                letterSpacing: 0,
                filter: 'blur(9px)',
                userSelect: 'none',
                textShadow: '0 0 30px rgba(255,154,74,0.28)',
              }}
            >
              {plan.price}
            </Typography>
            <Typography sx={{ color: '#c7d1e7', fontWeight: 950, fontSize: { xs: 18, md: 22 } }}>{plan.cadence}</Typography>
          </Stack>
        </Box>
        <Typography sx={{ color: '#c7d1e7', lineHeight: 1.62, fontSize: { xs: 17, md: 18 } }}>{plan.description}</Typography>
        <Divider flexItem sx={{ borderColor: 'rgba(255,255,255,0.18)' }} />
        <Stack spacing={1.15} sx={{ flex: 1 }}>
          {planFeatureRows.map((feature) => {
            const included = isAnnual ? feature.annual : feature.monthly;
            const lockedSavings = feature.label.includes('Economia de R$240');

            return (
              <Stack key={feature.label} direction="row" spacing={1} alignItems="center">
                <CheckCircleIcon sx={{ color: included ? '#35dc9b' : 'rgba(148,163,184,0.62)', fontSize: 22 }} />
                <Typography
                  data-locked-savings={lockedSavings ? 'true' : undefined}
                  sx={{
                    color: included ? '#e2e8f0' : '#94a3b8',
                    fontWeight: 950,
                    fontSize: { xs: 15.5, md: 16.5 },
                    textDecoration: included ? 'none' : 'line-through',
                    textDecorationThickness: '2px',
                    textDecorationColor: 'rgba(248,113,113,0.72)',
                    filter: lockedSavings ? 'blur(5px)' : 'none',
                    userSelect: lockedSavings ? 'none' : 'auto',
                  }}
                >
                  {feature.label}
                </Typography>
              </Stack>
            );
          })}
        </Stack>
        <Button
          type="button"
          onClick={() => onUnlock(plan.interval)}
          fullWidth
          size="large"
          variant="contained"
          sx={{
            minHeight: 64,
            borderRadius: 1.5,
            px: 3,
            bgcolor: '#35dc9b',
            background: '#35dc9b !important',
            backgroundColor: '#35dc9b !important',
            color: '#06110d',
            border: 0,
            fontWeight: 950,
            fontSize: { xs: 16, md: 18 },
            boxShadow: '0 12px 32px rgba(53,220,155,0.28), 0 0 44px rgba(53,220,155,0.16)',
            '&:hover': {
              bgcolor: '#22c98d',
              background: '#22c98d !important',
              backgroundColor: '#22c98d !important',
              boxShadow: '0 16px 38px rgba(53,220,155,0.34), 0 0 54px rgba(53,220,155,0.22)',
            },
          }}
        >
          Ver preços agora
        </Button>
      </Stack>
    </Paper>
  );
}

export default function Home() {
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>('annual');
  const [selectedMobilePlan, setSelectedMobilePlan] = useState<BillingInterval>('annual');
  const [selectedPhoneCountry, setSelectedPhoneCountry] = useState<PhoneCountry>(phoneCountries[0]);
  const [leadForm, setLeadForm] = useState<LeadFormState>(emptyLeadForm);
  const [leadErrors, setLeadErrors] = useState<Partial<Record<keyof LeadFormState, string>>>({});
  const [leadSubmitError, setLeadSubmitError] = useState('');
  const [leadSubmitting, setLeadSubmitting] = useState(false);

  function openLeadDialog(interval: BillingInterval) {
    setSelectedInterval(interval);
    setLeadErrors({});
    setLeadSubmitError('');
    setLeadDialogOpen(true);
  }

  function updateLeadField(field: keyof LeadFormState, value: string) {
    setLeadForm((current) => ({ ...current, [field]: field === 'phone' ? formatNationalPhoneInput(value, selectedPhoneCountry) : value }));
    setLeadErrors((current) => ({ ...current, [field]: undefined }));
    setLeadSubmitError('');
  }

  function updatePhoneCountry(countryCode: string) {
    const nextCountry = phoneCountries.find((country) => country.code === countryCode) || phoneCountries[0];
    setSelectedPhoneCountry(nextCountry);
    setLeadForm((current) => ({
      ...current,
      phone: formatNationalPhoneInput(current.phone, nextCountry),
    }));
    setLeadErrors((current) => ({ ...current, phone: undefined }));
    setLeadSubmitError('');
  }

  async function submitLeadForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateLeadForm(leadForm, selectedPhoneCountry);
    setLeadErrors(errors);
    setLeadSubmitError('');
    if (Object.keys(errors).length > 0) return;

    setLeadSubmitting(true);
    try {
      const token = await fetchMarketingCsrf();
      const phone = internationalLeadPhone(leadForm, selectedPhoneCountry);
      const response = await fetch('/api/marketing/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-flowme-csrf': token,
        },
        body: JSON.stringify({
          locale: 'pt-BR',
          source: 'lp_pt-br',
          path: window.location.pathname,
          referrer: document.referrer,
          visitor_id: browserId(window.localStorage, 'flowme_lp_visitor_id'),
          session_id: browserId(window.sessionStorage, 'flowme_lp_session_id'),
          name: leadForm.name.trim(),
          email: leadForm.email.trim().toLowerCase(),
          phone,
          interval: selectedInterval,
          utm_source: new URLSearchParams(window.location.search).get('utm_source') || '',
          utm_medium: new URLSearchParams(window.location.search).get('utm_medium') || '',
          utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign') || '',
          utm_content: new URLSearchParams(window.location.search).get('utm_content') || '',
          metadata: { price_gate: true, landing: 'next_home' },
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok || !payload.lead_token) throw new Error('lead');

      const lead = {
        ...leadForm,
        email: leadForm.email.trim().toLowerCase(),
        phone,
        lead_id: payload.lead_id,
        lead_token: payload.lead_token,
        interval: selectedInterval,
        locale: 'pt-br',
        capturedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(priceUnlockedStorageKey, 'true');
      window.localStorage.setItem(leadStorageKey, JSON.stringify(lead));
      window.location.assign(checkoutHref(lead));
    } catch {
      setLeadSubmitError('Não foi possível liberar o checkout agora. Tente novamente.');
      setLeadSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        overflowX: 'hidden',
        bgcolor: '#050609',
        color: '#f8fafc',
        background:
          'radial-gradient(circle at 18% 12%, rgba(249,115,22,0.16), transparent 28%), radial-gradient(circle at 78% 2%, rgba(34,211,238,0.14), transparent 26%), radial-gradient(circle at 42% 28%, rgba(99,102,241,0.18), transparent 34%), #050609',
      }}
    >
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'transparent !important',
          background: 'transparent !important',
          color: '#f8fafc',
          pt: { xs: 1, md: 1.2 },
          px: { xs: 1, md: 0 },
          boxShadow: 'none',
          border: 0,
        }}
      >
        <Container
          maxWidth={false}
          sx={{
            width: { xs: '100%', md: 'calc(100% - 96px)' },
            maxWidth: 1480,
            bgcolor: 'rgba(5,6,9,0.72)',
            background:
              'linear-gradient(90deg, rgba(5,6,9,0.92), rgba(40,22,45,0.74) 54%, rgba(5,6,9,0.86))',
            border: '2px solid rgba(167,139,250,0.18)',
            borderRadius: { xs: 4, md: 999 },
            boxShadow: '0 22px 60px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.08)',
            backdropFilter: 'blur(22px)',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ minHeight: { xs: 64, md: 76 }, px: { xs: 0, md: 1.5 } }}>
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <Image src="/brand/flowme-icon.png" alt="Flow Me" width={42} height={42} />
              <Typography fontWeight={950} sx={{ fontSize: 21, letterSpacing: 0 }}>
                Flow Me
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
              {navItems.map((item) => (
                <Button
                  key={item.href}
                  href={item.href}
                  sx={{
                    position: 'relative',
                    color: '#cbd5e1',
                    fontWeight: 850,
                    px: 1.6,
                    py: 1,
                    borderRadius: 999,
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      left: '50%',
                      bottom: 5,
                      width: 30,
                      height: 3,
                      borderRadius: 999,
                      bgcolor: '#d946ef',
                      transform: 'translateX(-50%) scaleX(0.2)',
                      opacity: 0,
                      transition: 'opacity 180ms ease, transform 180ms ease',
                    },
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.08)',
                      color: '#fff',
                    },
                    '&:hover::after': {
                      opacity: 1,
                      transform: 'translateX(-50%) scaleX(1)',
                    },
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Button
                href="#planos"
                variant="contained"
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  borderRadius: 999,
                  px: 2,
                  bgcolor: '#4f46e5',
                  fontWeight: 900,
                  boxShadow: '0 16px 34px rgba(79,70,229,0.24)',
                  '&:hover': { bgcolor: '#4338ca' },
                }}
              >
                Começar agora
              </Button>
            </Stack>
          </Stack>
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              display: { xs: 'flex', md: 'none' },
              overflowX: 'auto',
              pb: 1.25,
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {navItems.map((item) => (
              <Button
                key={item.href}
                href={item.href}
                size="small"
                sx={{
                  flex: '0 0 auto',
                  color: '#e2e8f0',
                  fontWeight: 850,
                  borderRadius: 999,
                  px: 1.2,
                  bgcolor: 'rgba(255,255,255,0.08)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
                }}
              >
                {item.label}
              </Button>
            ))}
          </Stack>
        </Container>
      </AppBar>

      <Box component="main">
        <Container maxWidth="lg" sx={{ pt: { xs: 2.5, md: 3 }, pb: { xs: 3.5, md: 4.5 } }}>
          <Grid container spacing={{ xs: 5, md: 8 }} alignItems="flex-start">
            <Grid item xs={12} md={6.4}>
              <Stack spacing={2.6} alignItems="flex-start" sx={{ pt: { md: 3 } }}>
                <Chip
                  icon={<Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#22c55e', boxShadow: '0 0 0 5px rgba(34,197,94,0.14)' }} />}
                  label="IA no WhatsApp para rotina, trabalho e vida real"
                  sx={{
                    bgcolor: 'rgba(99,102,241,0.12)',
                    color: '#fff',
                    border: '1px solid rgba(129,140,248,0.3)',
                    fontWeight: 900,
                    '& .MuiChip-icon': { ml: 1.5, mr: 0.5 },
                  }}
                />
                <Typography
                  component="h1"
                  sx={{
                    fontFamily: 'var(--font-plus-jakarta)',
                    fontWeight: 950,
                    fontSize: { xs: 43, sm: 58, md: 76 },
                    lineHeight: { xs: 1.02, md: 0.98 },
                    letterSpacing: 0,
                    color: '#f8fafc',
                  }}
                >
                  Flow Me.
                  <Box component="span" sx={{ display: 'block', color: '#f97316', textShadow: '0 22px 52px rgba(249,115,22,0.26)' }}>
                    Balys no seu WhatsApp.
                  </Box>
                </Typography>
                <Typography sx={{ maxWidth: 610, color: '#cbd5e1', fontSize: { xs: 18, md: 21 }, lineHeight: 1.55 }}>
                  Conselho de especialistas com inteligência artificial, agenda, lembretes, checklists, finanças
                  e integrações organizados por conversa. Você fala do seu jeito; o Balys entende, registra e
                  devolve o próximo passo.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                  <Button
                    href="#planos"
                    size="large"
                    variant="contained"
                    sx={{
                      minHeight: 52,
                      borderRadius: 999,
                      px: 3,
                      bgcolor: '#4f46e5',
                      fontWeight: 950,
                      boxShadow: '0 18px 38px rgba(79,70,229,0.28)',
                      '&:hover': { bgcolor: '#4338ca' },
                    }}
                  >
                    Começar agora
                  </Button>
                </Stack>
                <Grid container spacing={1.5} sx={{ pt: 1 }}>
                  {['Registre por áudio', 'Consulte em segundos', 'Organize tudo no painel'].map((label) => (
                    <Grid item xs={12} sm={4} key={label}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #d946ef, #8b5cf6)',
                            boxShadow: '0 0 0 6px rgba(139,92,246,0.12)',
                            flexShrink: 0,
                          }}
                        />
                        <Typography sx={{ color: '#e2e8f0', fontWeight: 850 }}>{label}</Typography>
                      </Stack>
                    </Grid>
                  ))}
                </Grid>
              </Stack>
            </Grid>
            <Grid item xs={12} md={5.6}>
              <WhatsAppIphone />
            </Grid>
          </Grid>
        </Container>

        <ProofMarquee />

        <SingularitySection />

        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
          <Grid container spacing={2.2}>
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <Grid item xs={12} md={6} key={feature.id}>
                  <Paper
                    id={feature.id}
                    elevation={0}
                    sx={{
                      height: '100%',
                      p: { xs: 2.5, md: 3.5 },
                      borderRadius: 2,
                      bgcolor: 'rgba(255,255,255,0.86)',
                      border: '1px solid rgba(99,102,241,0.14)',
                      boxShadow: '0 22px 60px rgba(15,23,42,0.06)',
                    }}
                  >
                    <Stack spacing={2.2}>
                      <Box
                        sx={{
                          display: 'grid',
                          placeItems: 'center',
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          color: '#fff',
                          background: 'linear-gradient(135deg, #f97316, #4f46e5)',
                        }}
                      >
                        <Icon />
                      </Box>
                      <Box>
                        <Typography sx={{ color: '#ea580c', fontWeight: 950, mb: 0.5 }}>{feature.eyebrow}</Typography>
                        <Typography component="h2" sx={{ color: '#0f172a', fontWeight: 950, fontSize: { xs: 26, md: 34 }, lineHeight: 1.1 }}>
                          {feature.title}
                        </Typography>
                      </Box>
                      <Typography sx={{ color: '#475569', lineHeight: 1.65, fontSize: 16.5 }}>{feature.body}</Typography>
                      <Stack spacing={1}>
                        {feature.bullets.map((bullet) => (
                          <Stack key={bullet} direction="row" spacing={1} alignItems="center">
                            <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 19 }} />
                            <Typography sx={{ color: '#334155', fontWeight: 800 }}>{bullet}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Container>

        <Box id="integracoes" sx={{ bgcolor: '#0f172a', color: '#e2e8f0', py: { xs: 6, md: 9 } }}>
          <Container maxWidth="lg">
            <Grid container spacing={4} alignItems="center">
              <Grid item xs={12} md={5}>
                <Stack spacing={2}>
                  <Chip
                    icon={<BalysIcon />}
                    label="Integrações"
                    sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(99,102,241,0.18)', color: '#c4b5fd', fontWeight: 900 }}
                  />
                  <Typography component="h2" sx={{ fontWeight: 950, fontSize: { xs: 34, md: 48 }, lineHeight: 1.05 }}>
                    Balys encontra o que você quer sem pedir ID, link ou nome técnico.
                  </Typography>
                  <Typography sx={{ color: '#cbd5e1', fontSize: 18, lineHeight: 1.6 }}>
                    Agenda, Slack, Drive e Sheets ficam conectados ao seu contexto. Você pede por nomes naturais,
                    e o Flow Me resolve a parte técnica por trás.
                  </Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} md={7}>
                <Grid container spacing={1.5}>
                  {integrations.map((integration) => {
                    const Icon = integration.icon;

                    return (
                      <Grid item xs={12} sm={6} key={integration.label}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            bgcolor: 'rgba(255,255,255,0.07)',
                            border: '1px solid rgba(255,255,255,0.12)',
                          }}
                        >
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box
                              sx={{
                                display: 'grid',
                                placeItems: 'center',
                                width: 42,
                                height: 42,
                                borderRadius: 2,
                                color: '#fff',
                                bgcolor: 'rgba(99,102,241,0.25)',
                              }}
                            >
                              <Icon />
                            </Box>
                            <Box>
                              <Typography sx={{ fontWeight: 950 }}>{integration.label}</Typography>
                              <Typography sx={{ color: '#94a3b8', fontSize: 14 }}>Conectado ao Balys AI</Typography>
                            </Box>
                          </Stack>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </Grid>
            </Grid>
          </Container>
        </Box>

        <Box
          id="planos"
          sx={{
            position: 'relative',
            overflow: 'hidden',
            py: { xs: 6, md: 9 },
            background:
              'radial-gradient(circle at 20% 8%, rgba(79,70,229,0.2), transparent 28%), radial-gradient(circle at 82% 20%, rgba(34,197,94,0.14), transparent 26%), linear-gradient(180deg, #eef6ff 0%, #f8fbff 46%, #eef6ff 100%)',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: '9% 4% auto',
              height: { xs: 260, md: 420 },
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.42)',
              filter: 'blur(50px)',
              pointerEvents: 'none',
            },
          }}
        >
          <Container maxWidth="lg" sx={{ position: 'relative' }}>
            <Stack spacing={3} alignItems="center" sx={{ textAlign: 'center', mb: { xs: 4, md: 5 } }}>
              <Chip
                label="Planos"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.72)',
                  color: '#3730a3',
                  border: '1px solid rgba(129,140,248,0.26)',
                  backdropFilter: 'blur(18px)',
                  fontWeight: 950,
                }}
              />
              <Typography component="h2" sx={{ color: '#0f172a', fontWeight: 950, fontSize: { xs: 34, md: 56 }, lineHeight: 1.04, maxWidth: 850 }}>
                Desbloqueie o preço do Flow Me completo.
              </Typography>
              <Typography sx={{ color: '#475569', fontSize: 18, maxWidth: 680 }}>
                WhatsApp, Balys AI, conselho de especialistas, lembretes, checklists, finanças e integrações em um plano Pro.
              </Typography>
            </Stack>
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            <Stack
              direction="row"
              role="tablist"
              aria-label="Selecionar plano"
              sx={{
                overflow: 'hidden',
                borderRadius: '14px 14px 0 0',
                border: '1px solid rgba(139,124,255,0.34)',
                bgcolor: 'rgba(255,255,255,0.9)',
              }}
            >
              {plans.map((plan) => {
                const selected = selectedMobilePlan === plan.interval;

                return (
                  <Button
                    key={plan.interval}
                    role="tab"
                    aria-selected={selected}
                    type="button"
                    onClick={() => setSelectedMobilePlan(plan.interval)}
                    sx={{
                      flex: 1,
                      minHeight: 82,
                      borderRadius: 0,
                      color: selected ? '#111827' : '#737373',
                      bgcolor: selected ? '#fff' : 'rgba(248,250,252,0.86)',
                      borderRight: plan.interval === 'monthly' ? '1px solid rgba(15,23,42,0.12)' : 0,
                      textTransform: 'none',
                      '&:hover': { bgcolor: selected ? '#fff' : '#f8fafc' },
                    }}
                  >
                    <Stack spacing={0.5} alignItems="center">
                      <Typography sx={{ fontWeight: 950, fontSize: 20, letterSpacing: 0 }}>
                        {plan.title}
                      </Typography>
                      <Typography sx={{ color: selected && plan.interval === 'annual' ? '#16a34a' : '#8a8a8a', fontWeight: 850, fontSize: 12.5 }}>
                        {plan.interval === 'annual' ? 'MAIS VENDIDO' : 'FLEXÍVEL'}
                      </Typography>
                    </Stack>
                  </Button>
                );
              })}
            </Stack>
            <PlanCard
              plan={plans.find((plan) => plan.interval === selectedMobilePlan) || plans[1]}
              onUnlock={openLeadDialog}
            />
          </Box>

          <Grid container spacing={3} justifyContent="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
            {plans.map((plan) => (
              <Grid item md={6} key={plan.title}>
                <PlanCard plan={plan} onUnlock={openLeadDialog} />
              </Grid>
            ))}
          </Grid>
          </Container>
        </Box>

        <Box
          component="footer"
          sx={{
            bgcolor: '#050609',
            color: '#f8fafc',
            borderTop: '1px solid rgba(148,163,184,0.14)',
            py: { xs: 6, md: 8 },
          }}
        >
          <Container maxWidth="lg">
            <Grid container spacing={{ xs: 4, md: 8 }}>
              <Grid item xs={12} md={5}>
                <Stack spacing={3}>
                  <Stack direction="row" spacing={1.2} alignItems="center">
                    <Image src="/brand/flowme-icon.png" alt="Flow Me" width={52} height={52} />
                    <Typography sx={{ fontSize: 30, fontWeight: 950 }}>Flow Me</Typography>
                  </Stack>
                  <Typography sx={{ maxWidth: 420, color: '#a1a1aa', fontSize: 19, lineHeight: 1.6 }}>
                    Seu sistema pessoal com IA para organizar WhatsApp, agenda, tarefas, finanças,
                    documentos e decisões em um só lugar.
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    {footerProof.map((item) => (
                      <Stack key={item} direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#d946ef' }} />
                        <Typography sx={{ color: '#c4c4cc', fontWeight: 850 }}>{item}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Stack spacing={2}>
                  <Typography sx={{ fontWeight: 950, fontSize: 22 }}>Produto</Typography>
                  {footerProducts.map((item) => (
                    <Button
                      key={item}
                      href={item === 'Planos' ? '#planos' : `#${item.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`}
                      sx={{ alignSelf: 'flex-start', color: '#a1a1aa', p: 0, fontSize: 18, fontWeight: 700, '&:hover': { color: '#fff', bgcolor: 'transparent' } }}
                    >
                      {item}
                    </Button>
                  ))}
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Stack spacing={2}>
                  <Typography sx={{ fontWeight: 950, fontSize: 22 }}>Conta</Typography>
                  <Button href="/login" sx={{ alignSelf: 'flex-start', color: '#a1a1aa', p: 0, fontSize: 18, fontWeight: 700, '&:hover': { color: '#fff', bgcolor: 'transparent' } }}>
                    Login
                  </Button>
                  <Button href="#planos" sx={{ alignSelf: 'flex-start', color: '#a1a1aa', p: 0, fontSize: 18, fontWeight: 700, '&:hover': { color: '#fff', bgcolor: 'transparent' } }}>
                    Assinar plano
                  </Button>
                  <Button href="/privacidade" sx={{ alignSelf: 'flex-start', color: '#a1a1aa', p: 0, fontSize: 18, fontWeight: 700, '&:hover': { color: '#fff', bgcolor: 'transparent' } }}>
                    Política de privacidade
                  </Button>
                  <Button href="/termos" sx={{ alignSelf: 'flex-start', color: '#a1a1aa', p: 0, fontSize: 18, fontWeight: 700, '&:hover': { color: '#fff', bgcolor: 'transparent' } }}>
                    Termos de uso
                  </Button>
                  <Box sx={{ pt: 2 }}>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 950, mb: 1 }}>Fale com a nossa equipe</Typography>
                    <Typography sx={{ color: '#a1a1aa', lineHeight: 1.6 }}>
                      Precisa de ajuda para escolher um plano ou acessar sua conta? Nosso time responde pelo suporte do Flow Me.
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
            </Grid>
            <Divider sx={{ borderColor: 'rgba(148,163,184,0.16)', my: 4 }} />
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
              <Typography sx={{ color: '#71717a', fontWeight: 700 }}>
                © 2026 Flow Me. CNPJ: 49.858.359/0001-93. Rayan Barbieri Consultoria em Tecnologia. Todos os direitos reservados.
              </Typography>
              <Typography sx={{ color: '#71717a', fontWeight: 700 }}>
                Segurança, LGPD e IA aplicada à rotina real.
              </Typography>
            </Stack>
          </Container>
        </Box>
        <Dialog
          open={leadDialogOpen}
          onClose={() => {
            if (!leadSubmitting) setLeadDialogOpen(false);
          }}
          fullWidth
          maxWidth="sm"
          PaperProps={{
            sx: {
              borderRadius: 4,
              bgcolor: '#0f172a',
              color: '#f8fafc',
              border: '1px solid rgba(53,220,155,0.22)',
              background:
                'radial-gradient(circle at 18% 0%, rgba(249,115,22,0.16), transparent 28%), radial-gradient(circle at 82% 18%, rgba(53,220,155,0.12), transparent 30%), linear-gradient(145deg, #141b2c, #0f172a 62%, #08111c)',
              boxShadow: '0 26px 90px rgba(0,0,0,0.52), 0 0 70px rgba(53,220,155,0.12)',
            },
          }}
        >
          <DialogTitle sx={{ pb: 0.5, px: { xs: 2.4, sm: 4 }, pt: { xs: 2.8, sm: 3.5 } }}>
            <Stack spacing={1.2}>
              <Chip
                label={selectedInterval === 'annual' ? 'Plano anual' : 'Plano mensal'}
                sx={{
                  alignSelf: 'flex-start',
                  bgcolor: selectedInterval === 'annual' ? '#35dc9b' : 'rgba(255,255,255,0.08)',
                  color: selectedInterval === 'annual' ? '#06110d' : '#e2e8f0',
                  fontWeight: 950,
                }}
              />
              <Typography component="span" sx={{ color: '#f8fafc', fontWeight: 950, fontSize: { xs: 25, sm: 28 }, lineHeight: 1.08 }}>
                Desbloquear checkout
              </Typography>
            </Stack>
          </DialogTitle>
          <DialogContent sx={{ px: { xs: 2.4, sm: 4 }, pb: { xs: 2.8, sm: 4 } }}>
            <Box component="form" data-lead-form onSubmit={submitLeadForm} noValidate>
              <Stack spacing={2.1} sx={{ pt: 1 }}>
                {leadSubmitError && (
                  <Alert severity="error" sx={{ borderRadius: 2 }}>
                    {leadSubmitError}
                  </Alert>
                )}
                <TextField
                  label="Nome"
                  value={leadForm.name}
                  onChange={(event) => updateLeadField('name', event.target.value)}
                  error={Boolean(leadErrors.name)}
                  helperText={leadErrors.name || ' '}
                  autoComplete="name"
                  disabled={leadSubmitting}
                  fullWidth
                  inputProps={{ 'data-lead-field': 'name' }}
                  sx={leadTextFieldSx}
                />
                <TextField
                  label="Email"
                  value={leadForm.email}
                  onChange={(event) => updateLeadField('email', event.target.value)}
                  error={Boolean(leadErrors.email)}
                  helperText={leadErrors.email || ' '}
                  autoComplete="email"
                  inputMode="email"
                  disabled={leadSubmitting}
                  fullWidth
                  inputProps={{ 'data-lead-field': 'email' }}
                  sx={leadTextFieldSx}
                />
                <TextField
                  label="Celular/WhatsApp"
                  value={leadForm.phone}
                  onChange={(event) => updateLeadField('phone', event.target.value)}
                  error={Boolean(leadErrors.phone)}
                  helperText={leadErrors.phone || ' '}
                  autoComplete="tel"
                  inputMode="tel"
                  disabled={leadSubmitting}
                  fullWidth
                  inputProps={{ 'data-lead-field': 'phone' }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 1.4 }}>
                        <Stack direction="row" alignItems="center" spacing={1.15}>
                          <Box
                            component="select"
                            aria-label="País do telefone"
                            value={selectedPhoneCountry.code}
                            onChange={(event) => updatePhoneCountry(String(event.target.value))}
                            disabled={leadSubmitting}
                            sx={{
                              appearance: 'none',
                              border: 0,
                              outline: 0,
                              bgcolor: 'transparent',
                              color: '#f8fafc',
                              fontSize: 18,
                              width: 30,
                              cursor: leadSubmitting ? 'default' : 'pointer',
                              '& option': { color: '#111827', bgcolor: '#fff' },
                            }}
                          >
                            {phoneCountries.map((country) => (
                              <option key={country.code} value={country.code}>
                                {country.flag}
                              </option>
                            ))}
                          </Box>
                          <Typography sx={{ color: '#cbd5e1', fontWeight: 850, fontSize: 18 }}>
                            {selectedPhoneCountry.dialCode}
                          </Typography>
                          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(226,232,240,0.24)' }} />
                        </Stack>
                      </InputAdornment>
                    ),
                  }}
                  placeholder="Digite seu celular"
                  sx={leadTextFieldSx}
                />
                <Stack sx={{ pt: 0.4 }}>
                  <Button
                    type="submit"
                    data-lead-submit="true"
                    disabled={leadSubmitting}
                    fullWidth
                    variant="contained"
                    sx={{
                      minHeight: 56,
                      borderRadius: 1.6,
                      bgcolor: '#35dc9b',
                      color: '#06110d',
                      fontWeight: 950,
                      fontSize: 16,
                      boxShadow: '0 16px 36px rgba(53,220,155,0.22)',
                      '&:hover': { bgcolor: '#22c98d' },
                    }}
                  >
                    {leadSubmitting ? <CircularProgress size={22} sx={{ color: '#06110d' }} /> : 'Continuar para checkout'}
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </DialogContent>
        </Dialog>
      </Box>
    </Box>
  );
}
