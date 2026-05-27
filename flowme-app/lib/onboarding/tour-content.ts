export type TourLang = 'en' | 'pt';

export type SectionId = 'balys' | 'connections' | 'notes' | 'review';

export type TourFeature = { title: string; example: string };

export type TourSection = {
  id: SectionId;
  overline: string;
  title: string;
  intro: string;
  features: TourFeature[];
  bullets: string[];
  tip: string | null;
  mandatory: boolean;
};

export type TourLabels = {
  back: string;
  next: string;
  skip: string;
  finish: string;
  progress: (current: number, total: number) => string;
};

const SECTIONS: Record<TourLang, TourSection[]> = {
  pt: [
    {
      id: 'balys',
      overline: 'Conheça o Balys',
      title: 'Seu conselheiro de IA',
      intro:
        'O Balys é seu copiloto. Fale com ele em linguagem natural — por texto, áudio ou imagem — e ele age por você. Ele fica no menu lateral, em BalysAI.',
      features: [
        {
          title: 'Agenda',
          example: '"Agende um standup amanhã às 10h com a Ana" → ele cria o evento no Google Calendar e resolve o e-mail da Ana.',
        },
        {
          title: 'Metas e planos de ação',
          example: '"Quero faturar R$ 10k até dezembro" → ele monta a meta, define a rotina semanal e agenda os blocos.',
        },
        {
          title: 'Gmail, Docs, Sheets e Drive',
          example: '"O que a Ana falou sobre o contrato?" → ele procura no Gmail, lê e resume pra você.',
        },
        {
          title: 'Notícias, clima e pesquisa atual',
          example: '"Qual a previsão pra São Paulo amanhã?" ou "O que estão falando sobre IA hoje?"',
        },
        {
          title: 'Lembretes',
          example: '"Me lembra de ligar pro dentista amanhã às 14h" → ele agenda e te avisa.',
        },
      ],
      bullets: [
        'Toque no microfone para falar em vez de digitar — o áudio vira texto automaticamente.',
        'Toque no ícone de imagem para enviar uma foto (um print, um cardápio, um documento) e o Balys interpreta.',
      ],
      tip: 'Decisão difícil? Peça um conselho: escreva algo como "Devo trocar de emprego?" ou "convoca o conselho". Um time de especialistas (advogado, contador, médico, empreendedor e outros) debate e te entrega uma recomendação.',
      mandatory: false,
    },
    {
      id: 'connections',
      overline: 'Conexões',
      title: 'Conecte suas fontes de dados',
      intro:
        'Conexões ficam no menu lateral, em Conexões. Elas ligam o Balys às suas ferramentas do Google para ele ler e agir sobre seus dados — sempre com a sua permissão.',
      features: [],
      bullets: [
        'Gmail — buscar, ler e rascunhar e-mails.',
        'Google Docs — encontrar, ler, criar e analisar documentos.',
        'Google Sheets — ler e analisar planilhas.',
        'Google Drive — encontrar e ler seus arquivos.',
      ],
      tip: 'Depois de conectar uma vez, o Balys acha seus arquivos pelo nome — você não precisa colar links. Ex: "Resuma minha planilha Financeiro 2026". No chat, você também pode digitar /docs, /sheets, /drive ou /gmail para escolher a fonte.',
      mandatory: false,
    },
    {
      id: 'notes',
      overline: 'Notas',
      title: 'Sua memória externa',
      intro:
        'Notas ficam no menu lateral, em Notas. Use para anotações do dia, problemas, reflexões, informações importantes e registros sobre pessoas. Com volume, o Balys ganha contexto para te dar insights sobre o seu dia, seus relacionamentos e planos de ação para te levar a outro nível.',
      features: [],
      bullets: [
        'Escreva em texto rico e use @ para mencionar pessoas.',
        'Toque no microfone para gravar uma nota em áudio — ela é transcrita automaticamente.',
        'Daily briefing (bom dia / boa noite): um resumo na aba Hoje com clima, agenda, sua meta principal, notícias e trends dos seus tópicos.',
        'Você acabou de definir horários e tópicos do briefing; pode ajustá-los depois em Configurações. Ele aparece em Hoje e chega no WhatsApp/navegador se você ativou.',
      ],
      tip: 'Importar de ChatGPT ou Claude: peça um resumo do seu dia com um prompt como "Resuma em tópicos meus compromissos, prioridades e reflexões de hoje". Copie a resposta e cole no Balys dizendo "anota isso no meu briefing" — ele guarda e usa pra te dar insights.',
      mandatory: false,
    },
    {
      id: 'review',
      overline: 'Onde rever isso',
      title: 'Pode rever quando quiser',
      intro:
        'Tudo isso fica salvo na seção Tutoriais, no menu. Lá você encontra guias passo a passo de cada recurso para extrair o máximo do Flow-me, dar um boost na sua produtividade e na inteligência que a IA te entrega. Volte sempre que precisar.',
      features: [],
      bullets: [],
      tip: null,
      mandatory: true,
    },
  ],
  en: [
    {
      id: 'balys',
      overline: 'Meet Balys',
      title: 'Your AI counselor',
      intro:
        'Balys is your copilot. Talk to him in plain language — by text, voice, or image — and he takes action for you. Find him in the side menu under BalysAI.',
      features: [
        {
          title: 'Calendar',
          example: '"Schedule a standup tomorrow at 10am with Anna" → he creates the Google Calendar event and resolves Anna\'s email.',
        },
        {
          title: 'Goals and action plans',
          example: '"I want to make $10k by December" → he builds the goal, sets a weekly routine, and books the time blocks.',
        },
        {
          title: 'Gmail, Docs, Sheets and Drive',
          example: '"What did Anna say about the contract?" → he searches Gmail, reads it, and summarizes for you.',
        },
        {
          title: 'News, weather and live search',
          example: '"What\'s the forecast for São Paulo tomorrow?" or "What are people saying about AI today?"',
        },
        {
          title: 'Reminders',
          example: '"Remind me to call the dentist tomorrow at 2pm" → he schedules it and pings you.',
        },
      ],
      bullets: [
        'Tap the microphone to speak instead of typing — your audio is transcribed automatically.',
        'Tap the image icon to send a photo (a screenshot, a menu, a document) and Balys reads it.',
      ],
      tip: 'Tough call? Ask for advice: type something like "Should I change jobs?" or "convene the council". A team of specialists (lawyer, accountant, doctor, entrepreneur and more) debates it and hands you a recommendation.',
      mandatory: false,
    },
    {
      id: 'connections',
      overline: 'Connections',
      title: 'Connect your data sources',
      intro:
        'Connections live in the side menu under Connectors. They link Balys to your Google tools so he can read and act on your data — always with your permission.',
      features: [],
      bullets: [
        'Gmail — search, read and draft emails.',
        'Google Docs — find, read, create and analyze documents.',
        'Google Sheets — read and analyze spreadsheets.',
        'Google Drive — find and read your files.',
      ],
      tip: 'Once connected, Balys finds your files by name — no need to paste links. e.g. "Summarize my Finance 2026 sheet". In chat you can also type /docs, /sheets, /drive or /gmail to pick a source.',
      mandatory: false,
    },
    {
      id: 'notes',
      overline: 'Notes',
      title: 'Your external memory',
      intro:
        'Notes live in the side menu under Notes. Use them for daily notes, problems, reflections, important info, and records about people. With volume, Balys gains the context to give you insights about your day, your relationships, and action plans to take you to the next level.',
      features: [],
      bullets: [
        'Write in rich text and use @ to mention people.',
        'Tap the microphone to record an audio note — it is transcribed automatically.',
        'Daily briefing (good morning / good evening): a summary on the Today tab with weather, your schedule, your main goal, news and trends for your topics.',
        'You just set your briefing times and topics; you can adjust them later in Settings. It shows up in Today and arrives via WhatsApp/browser if you enabled it.',
      ],
      tip: 'Import from ChatGPT or Claude: ask for a recap of your day with a prompt like "Summarize my commitments, priorities and reflections for today in bullet points". Copy the answer and paste it into Balys saying "save this to my briefing" — he keeps it and uses it to give you insights.',
      mandatory: false,
    },
    {
      id: 'review',
      overline: 'Where to review this',
      title: 'Review anytime',
      intro:
        'All of this lives in the Tutorials section in the menu. There you will find step-by-step guides for every feature to get the most out of Flow-me and boost your productivity and the intelligence the AI gives you. Come back whenever you need.',
      features: [],
      bullets: [],
      tip: null,
      mandatory: true,
    },
  ],
};

const LABELS: Record<TourLang, TourLabels> = {
  pt: {
    back: 'Voltar',
    next: 'Próximo',
    skip: 'Pular tutorial',
    finish: 'Começar minha jornada',
    progress: (current, total) => `${current} de ${total}`,
  },
  en: {
    back: 'Back',
    next: 'Next',
    skip: 'Skip tutorial',
    finish: "Let's start",
    progress: (current, total) => `${current} of ${total}`,
  },
};

export function getTourSections(lang: TourLang): TourSection[] {
  return SECTIONS[lang];
}

export function getTourLabels(lang: TourLang): TourLabels {
  return LABELS[lang];
}

export function reviewSectionIndex(sections: TourSection[]): number {
  return sections.findIndex((s) => s.mandatory);
}

export function canSkipSection(sections: TourSection[], index: number): boolean {
  const section = sections[index];
  return !!section && !section.mandatory;
}

export function clampSectionIndex(index: number, total: number): number {
  if (index < 0) return 0;
  if (index > total - 1) return total - 1;
  return index;
}
