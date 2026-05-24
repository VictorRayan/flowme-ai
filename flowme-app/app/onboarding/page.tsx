'use client';

import * as React from 'react';
import { Box, Typography, Button, TextField, Container, Fade, IconButton, CircularProgress, Paper, Divider, Chip, Stack, Switch, FormControlLabel } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LanguageIcon from '@mui/icons-material/Language';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import { useRouter } from 'next/navigation';
import BalysMarkdown from '@/components/markdown/BalysMarkdown';

const dict = {
  pt: {
    welcome: 'Bem-vindo ao Flow-me.',
    choose_lang: 'Por favor, escolha seu idioma.',
    
    prelude_title: 'Definindo sua Direção',
    prelude_desc: 'Antes de sincronizar sua agenda, configurar seu foco diário ou usar os conselheiros, precisamos de clareza. O Flow-me não é um gerenciador de tarefas, é o seu ecossistema focado no que importa. Vamos começar criando a sua direção central.',
    
    step1_overline: 'Passo 1: Quantidade',
    step1_title: 'Quantos grandes objetivos você quer focar neste ano?',
    step1_desc: 'O Balys (seu conselheiro de IA) sugere focar em no máximo 3 grandes mudanças de vida para garantir progresso real.',
    
    step2_overline: 'Consultoria de IA',
    step2_title: 'Vamos estruturar o Objetivo',
    step2_desc: 'Diga ao Balys o que você quer alcançar (ex: "Quero ganhar 5kg de músculo"). Ele vai te ajudar a estruturar.',
    
    step3_title: 'Seus Rituais Diários',
    step3_desc: 'O Flow-me trabalha com dois momentos do dia que serão seus aliados. Escolha os horários que funcionam melhor para você.',
    morning_sync: 'Planejamento do Dia',
    morning_desc: 'Todas as manhãs, o Flow-me vai analisar seus e-mails recentes, sincronizar seus compromissos da agenda e organizar suas prioridades do dia — separando o que é essencial, negociável e rotina.',
    evening_sync: 'Reflexão e Briefing',
    evening_desc: 'No final do dia, você faz uma reflexão rápida (por texto ou áudio) sobre o que aconteceu. O conselheiro de IA analisa seu progresso e ajusta o plano para amanhã.',
    
    btn_continue: 'Continuar',
    btn_start_setup: 'Começar minha configuração',
    btn_finish: 'Começar minha jornada',
    
    ai_typing: 'Balys está pensando...',
    your_reply: 'Sua resposta...',
    accept_proposal: 'Aceitar sugestão',
    start_typing: 'Comece a digitar seu objetivo...',
    hints: 'Ideias: Saúde (perder 5kg), Financeiro (guardar R$ 5k), Carreira (nova promoção)...',

    topics_title: 'Tópicos do seu interesse',
    topics_desc: 'Quais assuntos você quer ver no seu resumo de bom dia e boa noite? (até 3)',
    topics_placeholder: 'Ex: IA, mercado de startups, vôlei',
    topics_add: 'Adicionar',
    topics_max: 'Você pode adicionar até 3 tópicos',
    city_title: 'Sua cidade (pra previsão do tempo)',
    city_placeholder: 'Ex: São Paulo',
    delivery_title: 'Como quer receber',
    delivery_whatsapp: 'WhatsApp',
    delivery_push: 'Notificação no navegador',
    delivery_web: 'Sempre disponível no app',
  },
  en: {
    welcome: 'Welcome to Flow-me.',
    choose_lang: 'Please choose your language.',
    
    prelude_title: 'Setting Your Direction',
    prelude_desc: 'Before we sync your calendar, configure your daily focus, or unlock the AI counselors, we need clarity. Flow-me is not a task manager; it is an ecosystem focused on what matters. Let\'s start by setting your core direction.',

    step1_overline: 'Step 1: Quantity',
    step1_title: 'How many major goals do you want to achieve this year?',
    step1_desc: 'Balys (your AI counselor) suggests focusing on a maximum of 3 major life shifts to guarantee real progress.',
    
    step2_overline: 'AI Consultation',
    step2_title: 'Let\'s structure Goal',
    step2_desc: 'Tell Balys what you want to achieve (e.g., "I want to gain 10lbs of muscle"). He will help you crack it down.',
    
    step3_title: 'Your Daily Rituals',
    step3_desc: 'Flow-me works with two key moments each day that become your allies. Pick the times that work best for you.',
    morning_sync: 'Daily Planning',
    morning_desc: 'Every morning, Flow-me will scan your recent emails, sync your calendar events, and organize your priorities — separating essentials, negotiables, and routines.',
    evening_sync: 'Reflection & Briefing',
    evening_desc: 'At the end of the day, you do a quick reflection (text or voice) about what happened. The AI counselor analyzes your progress and adjusts tomorrow\'s plan.',
    
    btn_continue: 'Continue',
    btn_start_setup: 'Start my setup',
    btn_finish: 'Let\'s start',
    
    ai_typing: 'Balys is thinking...',
    your_reply: 'Your reply...',
    accept_proposal: 'Accept proposal',
    start_typing: 'Start typing your goal...',
    hints: 'Ideas: Health (lose 10lbs), Wealth (save $2k), Career (get promoted)...',

    topics_title: 'Topics you care about',
    topics_desc: 'What should we cover in your morning and evening briefing? (up to 3)',
    topics_placeholder: 'e.g. AI, startup funding, basketball',
    topics_add: 'Add',
    topics_max: 'You can add up to 3 topics',
    city_title: 'Your city (for the weather)',
    city_placeholder: 'e.g. New York',
    delivery_title: 'How you want it',
    delivery_whatsapp: 'WhatsApp',
    delivery_push: 'Browser notification',
    delivery_web: 'Always available in the app',
  }
};

type AIMessage = { role: 'user' | 'model'; content: string };
type ProposalData = {
  annual_smart_goal: string;
  monthly_milestone: string;
  weekly_routine: string;
  preferred_time?: string;
  default_task_duration_minutes?: number;
};

export default function OnboardingWizard() {
  const [step, setStep] = React.useState(0);
  const [lang, setLang] = React.useState<'en' | 'pt'>('pt');
  
  const [goalCount, setGoalCount] = React.useState(1);
  const [currentGoalIndex, setCurrentGoalIndex] = React.useState(1);
  
  // AI Chat State
  const [chatHistory, setChatHistory] = React.useState<AIMessage[]>([]);
  const [inputValue, setInputValue] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [aiProposal, setAiProposal] = React.useState<{ buttonText: string; data: ProposalData } | null>(null);
  const [acceptedProposals, setAcceptedProposals] = React.useState<ProposalData[]>([]);

  // Ritual Times
  const [morningTime, setMorningTime] = React.useState('08:00');
  const [eveningTime, setEveningTime] = React.useState('20:00');
  const [newsTopics, setNewsTopics] = React.useState<string[]>([]);
  const [topicDraft, setTopicDraft] = React.useState('');
  const [briefingCity, setBriefingCity] = React.useState('');
  const [deliverWhatsApp, setDeliverWhatsApp] = React.useState(true);
  const [deliverPush, setDeliverPush] = React.useState(false);

  const addTopic = () => {
    const cleaned = topicDraft.trim();
    if (!cleaned) return;
    if (newsTopics.includes(cleaned)) { setTopicDraft(''); return; }
    if (newsTopics.length >= 3) return;
    setNewsTopics([...newsTopics, cleaned]);
    setTopicDraft('');
  };
  const removeTopic = (topic: string) => setNewsTopics(newsTopics.filter((t) => t !== topic));

  // Auto-scroll ref
  const chatEndRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  const router = useRouter();
  const t = dict[lang];

  // Logic Flows
  const nextStep = () => {
    if (step === 2) {
      setStep(3); // Move to the AI consultation loop
    } else if (step === 3) {
      if (currentGoalIndex < goalCount) {
        // Go to next goal, clear chat history
        setCurrentGoalIndex(prev => prev + 1);
        setChatHistory([]);
        setAiProposal(null);
        setInputValue('');
      } else {
        setStep(4); // Go to final system contract
      }
    } else {
      setStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const finish = async () => {
    const proposalsToPersist = [...acceptedProposals];
    if (aiProposal?.data && proposalsToPersist.length < goalCount) {
      proposalsToPersist[currentGoalIndex - 1] = aiProposal.data;
    }
    try {
      await fetch('/api/v1/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ morningTime, eveningTime, goalProposals: proposalsToPersist.filter(Boolean) })
      });
    } catch (e) {
      console.error('Failed to save rhythm settings', e);
    }

    const delivery: string[] = ['web'];
    if (deliverWhatsApp) delivery.push('whatsapp');
    if (deliverPush) delivery.push('push');
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    try {
      await fetch('/api/briefings/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          morning_briefing_time: morningTime,
          evening_briefing_time: eveningTime,
          briefing_timezone: timezone,
          news_topics: newsTopics,
          briefing_delivery: delivery,
          daily_routine_enabled: true,
          briefing_city: briefingCity.trim() || null,
        }),
      });
    } catch (e) {
      console.error('Failed to save briefing preferences', e);
    }

    if (deliverPush) {
      try {
        const { registerWebPush } = await import('@/lib/web-push/client');
        await registerWebPush();
      } catch (e) {
        console.warn('Web push registration failed', e);
      }
    }

    router.push('/app/today');
  };

  const callAI = async (history: AIMessage[], userMsg: string): Promise<any> => {
    const priorProposals = acceptedProposals.filter(Boolean).map((p) => ({
      annual_smart_goal: p.annual_smart_goal,
      weekly_routine: p.weekly_routine,
      preferred_time: p.preferred_time,
      default_task_duration_minutes: p.default_task_duration_minutes,
    }));
    const res = await fetch('/api/v1/onboarding/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history, userMessage: userMsg, lang, priorProposals })
    });
    const data = await res.json();
    return data;
  };

  const acceptCurrentProposal = () => {
    if (!aiProposal?.data) return;
    setAcceptedProposals(prev => {
      const next = [...prev];
      next[currentGoalIndex - 1] = aiProposal.data;
      return next;
    });
    nextStep();
  };

  const sendMessage = async () => {
    if (!inputValue.trim()) return;
    
    const userMsg = inputValue;
    setInputValue('');
    const currentHistory = [...chatHistory];
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setAiProposal(null);
    setIsLoading(true);

    const MAX_RETRIES = 3;
    let attempt = 0;
    let data: any = null;

    while (attempt < MAX_RETRIES) {
      attempt++;
      try {
        data = await callAI(currentHistory, userMsg);
        if (data?.response && data.response.trim()) break; // Got a real response
      } catch (err) {
        console.warn(`AI attempt ${attempt} failed:`, err);
      }
      // Wait 2s before retrying
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (data?.response && data.response.trim()) {
      setChatHistory(prev => [...prev, { role: 'model', content: data.response }]);
      if (data.type === 'proposal') {
        setAiProposal({
          buttonText: data.proposalButtonText || t.accept_proposal,
          data: data.proposalData
        });
      }
    }
    // If all retries exhausted, spinner stops and input re-enables — user can naturally retry

    setIsLoading(false);
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: '#050505',
      backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #050505 50%)',
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      
      {/* Top Nav */}
      <Box sx={{ p: { xs: 2, md: 4 }, display: 'flex', justifyContent: 'center', alignItems: 'center', height: 80 }}>
        {step > 1 && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {[2,3,4].map((i) => (
              <Box 
                key={i} 
                sx={{ 
                  width: 40, height: 4, borderRadius: 2, 
                  bgcolor: i <= step ? 'primary.main' : 'rgba(255,255,255,0.1)',
                  transition: 'all 0.3s ease'
                }} 
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Main Content */}
      <Container maxWidth="sm" sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', pb: 10 }}>
        
        {/* Step 0: Language Selection */}
        {step === 0 && (
          <Fade in={step === 0} timeout={600}>
            <Box sx={{ textAlign: 'center' }}>
              <LanguageIcon sx={{ fontSize: 60, color: 'primary.main', mb: 3 }} />
              <Typography variant="h3" sx={{ fontWeight: 800, mb: 1, color: '#fff', letterSpacing: '-1px' }}>
                Flow-me
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 6 }}>
                Please choose your language / Por favor, escolha seu idioma.
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button 
                  variant="outlined"
                  onClick={() => { setLang('pt'); setStep(1); }}
                  sx={{ py: 3, px: 6, borderRadius: 4, fontSize: 18, borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
                >
                  Português
                </Button>
                <Button 
                  variant="outlined"
                  onClick={() => { setLang('en'); setStep(1); }}
                  sx={{ py: 3, px: 6, borderRadius: 4, fontSize: 18, borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
                >
                  English
                </Button>
              </Box>
            </Box>
          </Fade>
        )}

        {/* Step 1: Prelude/Purpose Introduction */}
        {step === 1 && (
          <Fade in={step === 1} timeout={600}>
            <Box sx={{ textAlign: 'center' }}>
              <TrackChangesIcon sx={{ fontSize: 60, color: 'primary.light', mb: 3 }} />
              <Typography variant="h3" sx={{ fontWeight: 800, mb: 3, color: '#fff', letterSpacing: '-1px' }}>
                {t.prelude_title}
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 8, fontSize: { xs: 16, md: 18 }, lineHeight: 1.7 }}>
                {t.prelude_desc}
              </Typography>
              
              <Button 
                variant="contained" 
                size="large"
                endIcon={<ArrowForwardIcon />}
                onClick={nextStep}
                sx={{ 
                  py: 2, px: 6, borderRadius: 3, fontSize: 18, fontWeight: 700, textTransform: 'none',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                }}
              >
                {t.btn_start_setup}
              </Button>
            </Box>
          </Fade>
        )}

        {/* Step 2: Goal Quantity */}
        {step === 2 && (
          <Fade in={step === 2} timeout={600}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="overline" sx={{ color: 'primary.light', tracking: 2, fontWeight: 700 }}>
                {t.step1_overline}
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, mb: 2, color: '#fff', letterSpacing: '-1px' }}>
                {t.step1_title}
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 6, fontSize: { xs: 16, md: 18 } }}>
                {t.step1_desc}
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, mb: 6 }}>
                <IconButton 
                  onClick={() => setGoalCount(Math.max(1, goalCount - 1))}
                  disabled={goalCount <= 1}
                  sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                  <RemoveIcon fontSize="large" />
                </IconButton>
                <Typography variant="h1" sx={{ fontWeight: 900, color: '#fff', minWidth: '80px', textAlign: 'center' }}>
                  {goalCount}
                </Typography>
                <IconButton 
                  onClick={() => setGoalCount(Math.min(5, goalCount + 1))}
                  disabled={goalCount >= 5}
                  sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                  <AddIcon fontSize="large" />
                </IconButton>
              </Box>

              <Button 
                variant="contained" 
                size="large"
                endIcon={<ArrowForwardIcon />}
                onClick={nextStep}
                sx={{ 
                  py: 2, px: 6, borderRadius: 3, fontSize: 18, fontWeight: 700, textTransform: 'none',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                }}
              >
                {t.btn_continue}
              </Button>
            </Box>
          </Fade>
        )}

        {/* Step 3: AI Consultation Loop */}
        {step === 3 && (
          <Fade in={step === 3} timeout={600}>
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <Typography variant="overline" sx={{ color: 'primary.light', tracking: 2, fontWeight: 700 }}>
                {t.step2_overline} {goalCount > 1 ? `(${currentGoalIndex} / ${goalCount})` : ''}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, mb: 1, color: '#fff', letterSpacing: '-1px' }}>
                {t.step2_title} {currentGoalIndex}
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
                {t.step2_desc}
              </Typography>
              
              {/* Chat Thread */}
              <Paper elevation={0} sx={{ 
                flex: 1, minHeight: '300px', maxHeight: '400px', overflowY: 'auto', 
                bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 4, p: 3, mb: 3, border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', flexDirection: 'column', gap: 2
              }}>
                {chatHistory.length === 0 && (
                  <Box sx={{ textAlign: 'center', m: 'auto' }}>
                    <AutoAwesomeIcon sx={{ fontSize: 40, mb: 1, color: 'primary.main', opacity: 0.8 }} />
                    <Typography variant="body1" sx={{ color: '#fff', mb: 1, fontWeight: 600 }}>
                      {t.start_typing}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                      {t.hints}
                    </Typography>
                  </Box>
                )}
                {chatHistory.filter(msg => msg.content && msg.content.trim()).map((msg, idx) => (
                  <Box key={idx} sx={{ 
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    bgcolor: msg.role === 'user' ? 'primary.main' : 'rgba(255,255,255,0.1)',
                    p: 2, borderRadius: 3, color: '#fff', maxWidth: '85%',
                    borderBottomRightRadius: msg.role === 'user' ? 4 : 12,
                    borderBottomLeftRadius: msg.role === 'model' ? 4 : 12,
                  }}>
                    {msg.role === 'user'
                      ? <Typography variant="body1" sx={{ fontSize: 16 }}>{msg.content}</Typography>
                      : <BalysMarkdown text={msg.content} />}
                  </Box>
                ))}
                
                {isLoading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, alignSelf: 'flex-start', p: 2 }}>
                    <CircularProgress size={20} sx={{ color: 'primary.light' }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t.ai_typing}</Typography>
                  </Box>
                )}
                <div ref={chatEndRef} />
              </Paper>

              {aiProposal && !isLoading && (
                <Button 
                  fullWidth variant="contained" size="large" onClick={acceptCurrentProposal}
                  sx={{ py: 2, borderRadius: 3, fontSize: 18, fontWeight: 700, textTransform: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', mb: 2 }}
                >
                  {aiProposal.buttonText}
                </Button>
              )}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField 
                  fullWidth value={inputValue} onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={t.your_reply}
                  sx={{ 
                    '& .MuiOutlinedInput-root': { 
                      bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 4, color: '#fff', 
                      '& fieldset': { border: 'none' },
                    }
                  }}
                />
                <IconButton onClick={sendMessage} disabled={isLoading || !inputValue.trim()} sx={{ bgcolor: 'primary.main', color: '#fff', borderRadius: 4, width: 56, height: 56, '&:hover': { bgcolor: 'primary.dark' } }}>
                  <SendIcon />
                </IconButton>
              </Box>
            </Box>
          </Fade>
        )}

        {/* Step 4: Final Ritual Contract */}
        {step === 4 && (
          <Fade in={step === 4} timeout={600}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 80, color: 'primary.main', mb: 3 }} />
              <Typography variant="h3" sx={{ fontWeight: 800, mb: 2, color: '#fff', letterSpacing: '-1px', textAlign: 'center' }}>
                {t.step3_title}
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 6, fontSize: { xs: 16, md: 18 }, maxWidth: 450, textAlign: 'center' }}>
                {t.step3_desc}
              </Typography>

              {/* Morning Ritual Card */}
              <Box sx={{ p: 3, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', mb: 3, width: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>{t.morning_sync}</Typography>
                  <TextField
                    type="time"
                    value={morningTime}
                    onChange={(e) => setMorningTime(e.target.value)}
                    sx={{ width: 130, '& .MuiOutlinedInput-root': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2, '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } }, '& .MuiOutlinedInput-input': { py: 1, textAlign: 'center' } }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: 'text.disabled', lineHeight: 1.6 }}>
                  {t.morning_desc}
                </Typography>
              </Box>

              {/* Evening Ritual Card */}
              <Box sx={{ p: 3, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', mb: 3, width: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>{t.evening_sync}</Typography>
                  <TextField
                    type="time"
                    value={eveningTime}
                    onChange={(e) => setEveningTime(e.target.value)}
                    sx={{ width: 130, '& .MuiOutlinedInput-root': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2, '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } }, '& .MuiOutlinedInput-input': { py: 1, textAlign: 'center' } }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: 'text.disabled', lineHeight: 1.6 }}>
                  {t.evening_desc}
                </Typography>
              </Box>

              {/* City for weather */}
              <Box sx={{ p: 3, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', mb: 3, width: '100%' }}>
                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700, mb: 1.5 }}>{t.city_title}</Typography>
                <TextField
                  fullWidth
                  value={briefingCity}
                  onChange={(e) => setBriefingCity(e.target.value)}
                  placeholder={t.city_placeholder}
                  sx={{ '& .MuiOutlinedInput-root': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2, '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } } }}
                />
              </Box>

              {/* News topics chips */}
              <Box sx={{ p: 3, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', mb: 3, width: '100%' }}>
                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700, mb: 0.5 }}>{t.topics_title}</Typography>
                <Typography variant="body2" sx={{ color: 'text.disabled', mb: 2 }}>{t.topics_desc}</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: newsTopics.length > 0 ? 2 : 0 }}>
                  {newsTopics.map((topic) => (
                    <Chip key={topic} label={topic} onDelete={() => removeTopic(topic)} sx={{ bgcolor: 'rgba(99,102,241,0.18)', color: '#a5b4fc', '& .MuiChip-deleteIcon': { color: '#a5b4fc' } }} />
                  ))}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField
                    fullWidth
                    value={topicDraft}
                    onChange={(e) => setTopicDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }}
                    placeholder={t.topics_placeholder}
                    disabled={newsTopics.length >= 3}
                    sx={{ '& .MuiOutlinedInput-root': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2, '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } } }}
                  />
                  <Button variant="outlined" onClick={addTopic} disabled={!topicDraft.trim() || newsTopics.length >= 3} sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 2, minWidth: 90 }}>
                    {t.topics_add}
                  </Button>
                </Stack>
                {newsTopics.length >= 3 && (
                  <Typography variant="caption" sx={{ color: 'text.disabled', mt: 1, display: 'block' }}>{t.topics_max}</Typography>
                )}
              </Box>

              {/* Delivery toggles */}
              <Box sx={{ p: 3, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', mb: 5, width: '100%' }}>
                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700, mb: 1.5 }}>{t.delivery_title}</Typography>
                <Stack spacing={1}>
                  <FormControlLabel
                    control={<Switch checked disabled />}
                    label={<Typography sx={{ color: 'text.disabled' }}>{t.delivery_web}</Typography>}
                  />
                  <FormControlLabel
                    control={<Switch checked={deliverWhatsApp} onChange={(e) => setDeliverWhatsApp(e.target.checked)} />}
                    label={<Typography sx={{ color: '#fff' }}>{t.delivery_whatsapp}</Typography>}
                  />
                  <FormControlLabel
                    control={<Switch checked={deliverPush} onChange={(e) => setDeliverPush(e.target.checked)} />}
                    label={<Typography sx={{ color: '#fff' }}>{t.delivery_push}</Typography>}
                  />
                </Stack>
              </Box>

              <Button
                fullWidth variant="contained" size="large" onClick={finish}
                sx={{ py: 2.5, borderRadius: 4, fontSize: 18, fontWeight: 700, textTransform: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
              >
                {t.btn_finish}
              </Button>
            </Box>
          </Fade>
        )}
      </Container>
    </Box>
  );
}
