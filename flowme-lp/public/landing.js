const marketingApiBase = window.FlowMeMarketingApiBase || "https://app.flow-me.online";

const copy = {
  "en-us": {
    title: "Flow Me | Personal assistant on WhatsApp",
    description:
      "Centralize WhatsApp, calendar, reminders, notes, finance, documents and work with your personal assistant on WhatsApp.",
    nav: ["Finance", "Testimonials", "Plans"],
    headerCta: "Start now",
    eyebrow: "AI on WhatsApp for routine, work and real life",
    h1: 'Get into flow with <em>your personal assistant on WhatsApp.</em>',
    hero:
      "Centralize calendar, reminders, notes, finance and work on WhatsApp. You speak. Flow Me records, organizes and reminds you of the next step.",
    reminder: {
      eyebrow: "WhatsApp reminders",
      title: "Never miss an important commitment again.",
      text:
        "Calendar, tasks and personal life stay in the same assistant. Flow Me reminds you before a small miss becomes a late reply, forgotten plan or rushed day.",
      proof: "The assistant remembers for you",
      bullets: [
        "Important commitments before they become late.",
        "Client follow-ups at the right time.",
        "Personal plans that should not live in your memory.",
      ],
      date: "Tue, July 7",
      notifications: [
        {
          app: "Flow Me on WhatsApp",
          title: "Girlfriend's birthday tomorrow",
          body: "Buy the gift by 6 PM and book dinner.",
          time: "now",
        },
        {
          app: "Flow Me on WhatsApp",
          title: "Client Felipe",
          body: "Send the revised proposal before 2:30 PM.",
          time: "12 min",
        },
        {
          app: "Flow Me on WhatsApp",
          title: "Closing call at 3 PM",
          body: "Review price, risk and next step.",
          time: "28 min",
        },
      ],
    },
    primary: "Start now",
    secondary: "See features",
    pills: ["Capture by voice", "Ask in seconds", "Organize in the dashboard"],
    finance: {
      eyebrow: "Financial Control",
      title: "Log expenses by voice or text.",
      text:
        "Send expenses and income through WhatsApp. Flow Me understands natural language, categorizes everything and shows the summary you need to decide better.",
      checks: [
        "Ask about any expense on WhatsApp",
        "Expenses arrive categorized",
        "Daily summary sent to you",
      ],
      userMessages: [
        "I paid US$ 12.40 at the grocery store",
        "How much did I spend on iFood this month?",
      ],
      botMessages: [
        "Done! US$ 12.40 logged under Groceries.",
        "You spent US$ 429.20 on iFood this month across 7 orders. The highest day was Friday.",
      ],
      placeholder: "Message",
      today: "Today",
      balance: "US$ 429.20",
      rows: [
        ["iFood orders", "US$ 429.20"],
        ["Average order", "US$ 61.31"],
        ["Biggest day", "Friday"],
      ],
    },
    financeChart: {
      title: "This month's spending",
      total: "US$ 974.88",
      subtitle: "July, by category",
      rows: [
        ["iFood", "US$ 429.20"],
        ["Groceries", "US$ 197.28"],
        ["Bills", "US$ 178.00"],
        ["Transport", "US$ 102.40"],
        ["Leisure", "US$ 68.00"],
      ],
    },
    singularity: {
      chip: "Everything in one place",
      title: "Everything in one place. Your agent organizes it for you.",
      text:
        "Slack, Gmail, Drive, Docs, Sheets, calendar, meetings and notes orbit the same singularity. Flow Me pulls everything to the center and returns the next organized step on your WhatsApp.",
      nodes: [
        "Gmail",
        "Slack",
        "Drive",
        "Sheets",
        "Calendar",
        "Checklist",
        "Docs",
        "Files",
        "Documents",
        "Bank",
        "Meetings",
        "Goals",
        "Notes",
      ],
    },
    agenda: {
      eyebrow: "Smart Calendar",
      title: "Never miss an appointment again.",
      text:
        "Get reminders and daily summaries. Log appointments on WhatsApp in your own words: Flow Me understands and organizes your routine. Everything synced with your Google Calendar.",
      checks: [
        "Check your calendar on WhatsApp",
        "Mark today's tasks as done",
        "Synced with Google Calendar",
      ],
      appName: "Google Calendar",
      notificationTitle: "Flow Me",
      notificationBody: "Your appointments are already synced with your Google Calendar! 📅",
      notificationTime: "now",
      week: [["MON", "28"], ["TUE", "29"], ["WED", "30"], ["THU", "1"], ["FRI", "2"]],
      events: [
        ["🦷 Dentist", "09:00 - 10:00"],
        ["📞 Sales call", "11:00 - 12:00"],
        ["🎬 Ad shoot", "14:00 - 16:00"],
      ],
    },
    pricingEyebrow: "Special offer",
    pricingTitle: "One plan to centralize your life.",
    pricingText:
      "Personal assistant, calendar, tasks, checklists, notes, reviews, connectors and reminders in one subscription.",
    soon: {
      eyebrow: "Coming soon",
      title: "Join now and get access to the future of Flow Me.",
      items: [
        ["Android and iOS mobile app", "No extra cost for current buyers."],
        ["WhatsApp filter", "Work only with what matters."],
        ["Telegram", "One more channel connected to your assistant."],
        ["Microsoft Teams", "Work context inside your assistant."],
      ],
    },
    plans: {
      monthlyTitle: "Monthly",
      monthlyDescription: "Full Flow Me Pro without annual commitment. Ideal for testing with your real routine.",
      monthlyCurrency: "US$",
      monthlyPrice: "11.90",
      monthlyPeriod: "/mo",
      monthlyBadge: "Flexible",
      annualTitle: "Annual",
      annualDescription: "Best price to centralize calendar, tasks, WhatsApp, finance, notes and your personal assistant.",
      annualCurrency: "US$",
      annualPrice: "7.90",
      annualPeriod: "/mo",
      annualBadge: "33% OFF",
      popular: "★ Best seller",
    },
    lockedTitle: "Unlock the special price",
    lockedText: "Fill in your details to reveal the offer on this page.",
    modalTitle: "Unlock your Flow Me offer",
    modalText: "Tell us where to send your access. The price appears here after confirmation.",
    name: "Name",
    namePlaceholder: "Your name",
    email: "Email",
    emailPlaceholder: "you@email.com",
    phone: "Phone",
    phonePlaceholder: "+1 (555) 000-0000",
    unlock: "See prices now",
    guarantee: "Claim offer",
    sending: "Sending...",
    invalidName: "Enter your name.",
    invalidEmail: "Enter a valid email.",
    invalidPhone: "Enter a valid WhatsApp number.",
    submitError: "We could not unlock the checkout link. Refresh and try again.",
    submitSuccess: "Price unlocked.",
    price: "US$ 7.90",
    priceNote: "/month billed yearly",
    buy: "Buy now",
    secure: "Secure purchase. Cancel anytime.",
    testimonialsTitle: "Real users using Flow Me every day.",
    faqTitle: "Quick questions about centralizing your routine.",
    faqs: [
      {
        question: "What is Flow Me?",
        answer:
          "A personal assistant to centralize WhatsApp, calendar, reminders, notes, finance, documents and work. You speak naturally and it organizes the next step.",
      },
      {
        question: "Does it work on WhatsApp?",
        answer:
          "Yes. You can ask, save and receive reminders on WhatsApp. The web dashboard helps you review everything later.",
      },
      {
        question: "How do reminders work?",
        answer:
          'You ask in plain language, such as "remind me tomorrow at 9 AM to call the client". Flow Me saves it and reminds you at the right time.',
      },
      {
        question: "Can I use it with Slack?",
        answer:
          "Yes. Flow Me can use Slack context to help you find important signals, turn conversations into tasks and track follow-ups.",
      },
      {
        question: "Does it work with Google Docs, Drive and Sheets?",
        answer:
          "Yes. You can ask for files and spreadsheets by natural names. The assistant searches Drive, reads connected Docs and Sheets and returns practical answers.",
      },
      {
        question: "Can it organize finance?",
        answer:
          "Yes. You can log expenses by conversation, check categories and track income, spending and financial decisions in one place.",
      },
      {
        question: "Can I use it for notes?",
        answer:
          "Yes. Flow Me stores notes, ideas, decisions and daily context. Later you can ask and recover what was saved.",
      },
      {
        question: "Do I need to install an app?",
        answer:
          "No. The web app already works. The Android and iOS mobile apps will be released later at no extra cost for current buyers.",
      },
    ],
    testimonials: [
      {
        name: "Victor Rayan",
        role: "Revenue Operations & Software Engineer",
        quote:
          '"Flow Me helps me execute what matters. It connects Slack, Gmail, tasks and personal life. I get the right signals and stop living in firefighting mode."',
      },
      {
        name: "Leticia Goncalves dos Santos",
        role: "CRM Analyst",
        quote:
          '"I can organize groceries, errands, study, English class, therapy and personal commitments in the same day without losing anything. I really want the mobile app."',
      },
    ],
    testimonial1:
      '"I work in Revenue Operations and Flow Me helps me execute what matters. It connects Slack, Gmail, tasks and personal life. I get the right signals and stop living in firefighting mode."',
    testimonial2:
      '"I can organize pets, groceries, errands, study, English class, therapy and personal commitments in the same day without losing my mind. I really want the mobile app."',
    footerSupport:
      "Need help choosing a plan or accessing your account? Contact support@flow-me.online.",
    footerRights:
      "© 2026 Flow Me. CNPJ: 49.858.359/0001-93. Rayan Barbieri Technology Consulting. All rights reserved.",
    footerSecurity:
      "Security, GDPR compliance and AI applied to real routine.",
  },
  "pt-br": {
    title: "Flow Me | Assistente pessoal no WhatsApp",
    description:
      "Centralize WhatsApp, agenda, lembretes, notas, financas, documentos e trabalho com seu assistente pessoal no WhatsApp.",
    nav: ["Financeiro", "Depoimentos", "Planos"],
    headerCta: "Comecar agora",
    eyebrow: "IA no WhatsApp para rotina, trabalho e vida real",
    h1: 'Entre em flow com <em>seu assistente pessoal no seu WhatsApp.</em>',
    hero:
      "Centralize agenda, lembretes, notas, financas e trabalho no WhatsApp. Voce fala. O Flow Me registra, organiza e lembra o proximo passo.",
    reminder: {
      eyebrow: "Lembretes no WhatsApp",
      title: "Nunca mais esqueca um compromisso.",
      text:
        "Agenda, tarefas e vida pessoal ficam no mesmo assistente. O Flow Me avisa antes do assunto virar atraso, esquecimento ou correria.",
      proof: "O assistente lembra por voce",
      bullets: [
        "Compromissos importantes antes de atrasar.",
        "Follow-up de cliente no horario certo.",
        "Planos pessoais que nao podem ficar na memoria.",
      ],
      date: "Ter, 7 de julho",
      notifications: [
        {
          app: "Flow Me no WhatsApp",
          title: "Aniversario da namorada amanha",
          body: "Comprar presente hoje ate 18h e reservar o jantar.",
          time: "agora",
        },
        {
          app: "Flow Me no WhatsApp",
          title: "Cliente Felipe",
          body: "Enviar proposta revisada antes das 14h30.",
          time: "12 min",
        },
        {
          app: "Flow Me no WhatsApp",
          title: "Call de fechamento as 15h",
          body: "Revisar preco, risco e proximo passo.",
          time: "28 min",
        },
      ],
    },
    primary: "Comecar agora",
    secondary: "Ver funcionalidades",
    pills: ["Registre por audio", "Consulte em segundos", "Organize tudo no painel"],
    finance: {
      eyebrow: "Controle Financeiro",
      title: "Anote seus gastos por audio ou texto.",
      text:
        "Registre despesas e receitas pelo WhatsApp. O Flow Me entende sua fala, categoriza tudo e mostra o resumo para voce decidir melhor.",
      checks: [
        "Consulte qualquer gasto pelo WhatsApp",
        "Gastos chegam categorizados",
        "Resumo do dia direto para voce",
      ],
      userMessages: [
        "Paguei 62 reais no mercado",
        "Quanto gastei de iFood este mes?",
      ],
      botMessages: [
        "Anotado! R$ 62,00 registrado em Mercado.",
        "Voce gastou R$ 2.146,00 no iFood este mes em 7 pedidos. O maior dia foi sexta-feira.",
      ],
      placeholder: "Mensagem",
      today: "Hoje",
      balance: "R$ 2.146,00",
      rows: [
        ["Pedidos no iFood", "R$ 2.146,00"],
        ["Ticket medio", "R$ 306,57"],
        ["Maior dia", "Sexta-feira"],
      ],
    },
    financeChart: {
      title: "Gastos do mes",
      total: "R$ 4.874,40",
      subtitle: "Julho, por categoria",
      rows: [
        ["iFood", "R$ 2.146,00"],
        ["Mercado", "R$ 986,40"],
        ["Contas", "R$ 890,00"],
        ["Transporte", "R$ 512,00"],
        ["Lazer", "R$ 340,00"],
      ],
    },
    singularity: {
      chip: "Tudo em um so lugar",
      title: "Tudo em um lugar so. Seu agente organiza por voce.",
      text:
        "Slack, Gmail, Drive, Docs, Sheets, agenda, reunioes e notas orbitam a mesma singularidade. O Flow Me puxa tudo para o centro e devolve o proximo passo organizado no seu WhatsApp.",
      nodes: [
        "Gmail",
        "Slack",
        "Drive",
        "Sheets",
        "Agenda",
        "Checklist",
        "Docs",
        "Arquivos",
        "Documentos",
        "Banco",
        "Reunioes",
        "Metas",
        "Notas",
      ],
    },
    agenda: {
      eyebrow: "Agenda Inteligente",
      title: "Nunca mais esqueca um compromisso.",
      text:
        "Tenha lembretes e resumos diarios. Registre compromissos no WhatsApp falando do seu jeito: o Flow Me entende e organiza sua rotina. Tudo sincronizado com seu Google Agenda.",
      checks: [
        "Consulte sua agenda pelo WhatsApp",
        "Marque tarefas do dia como feitas",
        "Sincronizado com o Google Agenda",
      ],
      appName: "Google Agenda",
      notificationTitle: "Flow Me",
      notificationBody: "Seus compromissos ja foram sincronizados com seu Google Agenda! 📅",
      notificationTime: "agora",
      week: [["SEG", "28"], ["TER", "29"], ["QUA", "30"], ["QUI", "1"], ["SEX", "2"]],
      events: [
        ["🦷 Dentista", "09:00 - 10:00"],
        ["📞 Call de vendas", "11:00 - 12:00"],
        ["🎬 Filmagem de anuncios", "14:00 - 16:00"],
      ],
    },
    pricingEyebrow: "Oferta especial",
    pricingTitle: "Um plano para centralizar sua vida.",
    pricingText:
      "Assistente pessoal, agenda, tarefas, checklists, notas, revisoes, conectores e lembretes em uma assinatura.",
    soon: {
      eyebrow: "Em breve",
      title: "Quem entra agora ganha acesso ao futuro do Flow Me.",
      items: [
        ["App mobile Android e iOS", "Acesso sem custo adicional para compradores atuais."],
        ["Filtro de WhatsApp", "Trabalhe somente com o que importa."],
        ["Telegram", "Mais um canal conectado ao Assistente."],
        ["Microsoft Teams", "Contexto de trabalho dentro do seu Assistente."],
      ],
    },
    plans: {
      monthlyTitle: "Mensal",
      monthlyDescription: "Flow Me Pro completo, sem compromisso anual. Ideal para testar com rotina real.",
      monthlyCurrency: "R$",
      monthlyPrice: "59,90",
      monthlyPeriod: "/mes",
      monthlyBadge: "Flexivel",
      annualTitle: "Anual",
      annualDescription: "Melhor preco para centralizar agenda, tarefas, WhatsApp, financas, notas e seu Assistente pessoal.",
      annualCurrency: "R$",
      annualPrice: "39,90",
      annualPeriod: "/mes",
      annualBadge: "33% OFF",
      popular: "★ Mais vendido",
    },
    lockedTitle: "Desbloqueie o preco especial",
    lockedText: "Preencha seus dados para revelar a oferta nesta pagina.",
    modalTitle: "Desbloqueie sua oferta Flow Me",
    modalText: "Informe para qual contato enviaremos seu acesso. O preco aparece aqui depois da confirmacao.",
    name: "Nome",
    namePlaceholder: "Seu nome",
    email: "Email",
    emailPlaceholder: "voce@email.com",
    phone: "Telefone",
    phonePlaceholder: "(11) 99999-9999",
    unlock: "Ver precos agora",
    guarantee: "Garantir oferta",
    sending: "Enviando...",
    invalidName: "Informe seu nome.",
    invalidEmail: "Informe um email valido.",
    invalidPhone: "Informe um WhatsApp valido.",
    submitError: "Nao conseguimos liberar o link de checkout. Atualize a pagina e tente novamente.",
    submitSuccess: "Preco desbloqueado.",
    price: "R$ 39,90",
    priceNote: "/mes no anual",
    buy: "Adquirir agora",
    secure: "Compra segura. Cancele quando quiser.",
    testimonialsTitle: "Usuarios reais usando o Flow Me no dia a dia.",
    faqTitle: "Duvidas rapidas sobre centralizar sua rotina.",
    faqs: [
      {
        question: "O que e o Flow Me?",
        answer:
          "Um assistente pessoal para centralizar WhatsApp, agenda, lembretes, notas, financas, documentos e trabalho. Voce fala de forma natural e ele organiza o proximo passo.",
      },
      {
        question: "Funciona pelo WhatsApp?",
        answer:
          "Sim. Voce pode pedir, registrar e receber lembretes pelo WhatsApp. O painel web ajuda a revisar tudo com calma depois.",
      },
      {
        question: "Como os lembretes funcionam?",
        answer:
          'Voce pede em linguagem simples, como "me lembra amanha as 9h de ligar para o cliente". O Flow Me salva o compromisso e te avisa no horario certo.',
      },
      {
        question: "Posso usar com Slack?",
        answer:
          "Sim. O Flow Me pode usar contexto do Slack para ajudar voce a encontrar sinais importantes, transformar conversas em tarefas e acompanhar follow-ups.",
      },
      {
        question: "Ele trabalha com Google Docs, Drive e Sheets?",
        answer:
          "Sim. Voce pode pedir por nomes naturais de arquivos e planilhas. O assistente procura no Drive, consulta Docs e Sheets conectados e devolve respostas praticas.",
      },
      {
        question: "Da para organizar financas?",
        answer:
          "Sim. Voce pode registrar gastos por conversa, consultar categorias e acompanhar entradas, saidas e decisoes financeiras em um so lugar.",
      },
      {
        question: "Ele tambem serve para notas?",
        answer:
          "Sim. O Flow Me guarda notas, ideias, decisoes e contexto do dia. Depois voce pode perguntar e recuperar o que foi registrado.",
      },
      {
        question: "Preciso instalar app?",
        answer:
          "Nao. O app web ja funciona. O app mobile Android e iOS sera liberado depois sem custo adicional para compradores atuais.",
      },
    ],
    testimonials: [
      {
        name: "Victor Rayan",
        role: "Revenue Operations & Engenheiro de Software",
        quote:
          '"O Flow Me me ajuda a executar o que importa. Ele cruza Slack, Gmail, tarefas e vida pessoal. Recebo os sinais certos e paro de viver apagando incendio."',
      },
      {
        name: "Leticia Goncalves dos Santos",
        role: "Analista de CRM",
        quote:
          '"Consigo organizar compras, rua, estudo, ingles, terapia e compromissos pessoais no mesmo dia, sem perder nada. Quero muito a versao mobile."',
      },
    ],
    testimonial1:
      '"Trabalho com Revenue Operations e o Flow Me me ajuda a executar o que importa. Ele cruza Slack, Gmail, tarefas e vida pessoal. Recebo os sinais certos e paro de viver apagando incendio."',
    testimonial2:
      '"Consigo organizar cachorros, compras, rua, estudo, ingles, ballet, terapia e compromissos pessoais. Tudo no mesmo dia, sem ficar maluca. Quero muito a versao mobile."',
    footerSupport:
      "Precisa de ajuda para escolher um plano ou acessar sua conta? Fale com support@flow-me.online.",
    footerRights:
      "© 2026 Flow Me. CNPJ: 49.858.359/0001-93. Rayan Barbieri Consultoria em Tecnologia. Todos os direitos reservados.",
    footerSecurity:
      "Seguranca, LGPD e IA aplicada a rotina real.",
  },
};

function getLocale() {
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith("/en-us")) return "en-us";
  return "pt-br";
}

function apiLocale(locale) {
  return locale === "en-us" ? "en-US" : "pt-BR";
}

function checkoutUrl(locale, lead) {
  const url = new URL(`${marketingApiBase}/checkout`);
  url.searchParams.set("locale", apiLocale(locale));
  url.searchParams.set("source", locale === "en-us" ? "lp_en-us" : "lp_pt-br");
  if (lead?.lead_token) url.searchParams.set("lead_token", lead.lead_token);
  if (lead?.name) url.searchParams.set("name", lead.name);
  if (lead?.email) url.searchParams.set("email", lead.email);
  if (lead?.phone) url.searchParams.set("phone", lead.phone);
  if (lead?.interval) url.searchParams.set("interval", lead.interval);
  return url.toString();
}

function readStoredLead(locale) {
  try {
    const storedLead = window.localStorage.getItem(`flowme_lp_lead_${locale}`);
    return storedLead ? JSON.parse(storedLead) : null;
  } catch {
    return null;
  }
}

function visitorId() {
  const key = "flowme_lp_visitor_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, id);
  return id;
}

function sessionId() {
  const key = "flowme_lp_session_id";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.sessionStorage.setItem(key, id);
  return id;
}

function utmPayload() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || "",
  };
}

async function csrfToken() {
  const response = await fetch(`${marketingApiBase}/api/marketing/csrf`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error("csrf");
  return payload.token;
}

async function marketingPost(path, body) {
  const token = await csrfToken();
  const response = await fetch(`${marketingApiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-FlowMe-CSRF": token },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload?.error?.message || "marketing");
  return payload;
}

function baseMarketingPayload(locale) {
  return {
    locale: apiLocale(locale),
    path: window.location.pathname,
    source: locale === "en-us" ? "landing_en-us" : "landing_pt-br",
    visitor_id: visitorId(),
    session_id: sessionId(),
    referrer: document.referrer || "",
    ...utmPayload(),
  };
}

function formatPhone(value, locale) {
  const digits = value.replace(/\D/g, "").slice(0, locale === "pt-br" ? 11 : 10);
  if (locale === "pt-br") {
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function validateLead(form, locale) {
  const t = copy[locale];
  const name = form.elements.name;
  const email = form.elements.email;
  const phone = form.elements.phone;
  const country = form.elements.country;
  const digits = phone.value.replace(/\D/g, "");
  const errors = {};
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
  const phoneOk = country?.value === "BR" ? digits.length >= 10 : digits.length >= 7;

  name.setAttribute("aria-invalid", String(name.value.trim().length < 2));
  email.setAttribute("aria-invalid", String(!emailOk));
  phone.setAttribute("aria-invalid", String(!phoneOk));
  if (name.value.trim().length < 2) errors.name = t.invalidName;
  if (!emailOk) errors.email = t.invalidEmail;
  if (!phoneOk) errors.phone = t.invalidPhone;
  return errors;
}

function showFieldErrors(errors = {}) {
  document.querySelectorAll("[data-field-error]").forEach((node) => {
    const field = node.getAttribute("data-field-error");
    node.textContent = errors[field] || "";
  });
}

function formFeedback(message, kind = "") {
  const node = document.querySelector("[data-form-feedback]");
  if (!node) return;
  node.textContent = message;
  node.className = `form-feedback ${kind}`.trim();
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node && value) node.textContent = value;
}

function setHtml(selector, value) {
  const node = document.querySelector(selector);
  if (node && value) node.innerHTML = value;
}

function setTexts(selector, values) {
  document.querySelectorAll(selector).forEach((node, index) => {
    if (values[index]) node.textContent = values[index];
  });
}

function fillPlanCard(interval, plan) {
  const card = document.querySelector(`[data-plan-card][data-interval="${interval}"]`);
  if (!card) return;
  card.querySelector("h3").textContent = plan.title;
  card.querySelector("p").textContent = plan.description;
  const priceParts = card.querySelectorAll(".locked-price span");
  if (priceParts[0]) priceParts[0].textContent = plan.currency;
  if (priceParts[1]) priceParts[1].textContent = plan.period;
  const price = card.querySelector(".locked-price strong");
  if (price) price.textContent = plan.price;
  const badge = card.querySelector(".discount-pill");
  if (badge) badge.textContent = plan.badge;
}

function applyLocale(locale) {
  const t = copy[locale];
  document.documentElement.lang = locale === "en-us" ? "en-US" : "pt-BR";
  document.title = t.title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", t.description);

  setTexts(".nav a", t.nav);
  setText(".header-cta", t.headerCta);
  setHtml(".hero .eyebrow", `<span></span>${t.eyebrow}`);
  setHtml(".hero h1", t.h1);
  setText(".hero-text", t.hero);
  setText(".hero-actions .primary-cta", t.primary);
  setText(".hero-actions .secondary-cta", t.secondary);
  setTexts(".hero-pills span", t.pills);
  if (t.reminder) {
    setText(".reminder-fold .eyebrow", t.reminder.eyebrow);
    setText(".reminder-fold h2", t.reminder.title);
    setText(".reminder-fold .section-heading p:not(.eyebrow)", t.reminder.text);
    setText(".reminder-proof-line strong", t.reminder.proof);
    setTexts(".reminder-copy li", t.reminder.bullets);
    setText(".lock-time span", t.reminder.date);
    document.querySelectorAll(".flow-notification").forEach((notification, index) => {
      const item = t.reminder.notifications[index];
      if (!item) return;
      const app = notification.querySelector(".notification-app");
      const title = notification.querySelector("strong");
      const body = notification.querySelector("p");
      const time = notification.querySelector("time");
      if (app) app.textContent = item.app;
      if (title) title.textContent = item.title;
      if (body) body.textContent = item.body;
      if (time) time.textContent = item.time;
    });
  }

  if (t.finance) {
    setText(".finance-control .eyebrow", t.finance.eyebrow);
    setText(".finance-control h2", t.finance.title);
    setText(".finance-copy > p:not(.eyebrow)", t.finance.text);
    setTexts(".finance-checks b", t.finance.checks);
    setTexts(".finance-message.user", t.finance.userMessages);
    setTexts(".finance-message.bot", t.finance.botMessages);
    setText(".finance-iphone .compose-input b", t.finance.placeholder);
    setText(".finance-summary-card > div:first-child span", t.finance.today);
    setText(".finance-summary-card > div:first-child strong", t.finance.balance);
    document.querySelectorAll(".finance-summary-card li").forEach((row, index) => {
      const item = t.finance.rows[index];
      if (!item) return;
      const title = row.querySelector("b");
      const value = row.querySelector("span");
      if (title) title.textContent = item[0];
      if (value) value.textContent = item[1];
    });
  }

  if (t.financeChart) {
    setText(".finance-chart-head span", t.financeChart.title);
    setText(".finance-chart-head strong", t.financeChart.total);
    setText(".finance-chart-head small", t.financeChart.subtitle);
    document.querySelectorAll(".finance-chart-bars li").forEach((row, index) => {
      const item = t.financeChart.rows[index];
      if (!item) return;
      const label = row.querySelector("b");
      const value = row.querySelector("em");
      if (label) label.textContent = item[0];
      if (value) value.textContent = item[1];
    });
  }

  if (t.singularity) {
    setText(".singularity-chip", t.singularity.chip);
    setText(".singularity-copy h2", t.singularity.title);
    setText(".singularity-copy p:not(.singularity-chip)", t.singularity.text);
    setTexts(".singularity-node b", t.singularity.nodes);
  }

  if (t.agenda) {
    setText(".agenda-copy .eyebrow", t.agenda.eyebrow);
    setText(".agenda-copy h2", t.agenda.title);
    setText(".agenda-copy > p:not(.eyebrow)", t.agenda.text);
    setTexts(".agenda-checks b", t.agenda.checks);
    setText(".gcal-header strong", t.agenda.appName);
    setText(".gcal-notification strong", t.agenda.notificationTitle);
    setText(".gcal-notification p", t.agenda.notificationBody);
    setText(".gcal-notification time", t.agenda.notificationTime);
    document.querySelectorAll(".gcal-week > div").forEach((day, index) => {
      const item = t.agenda.week[index];
      if (!item) return;
      const label = day.querySelector("span");
      const num = day.querySelector("b");
      if (label) label.textContent = item[0];
      if (num) num.textContent = item[1];
    });
    document.querySelectorAll(".gcal-event").forEach((event, index) => {
      const item = t.agenda.events[index];
      if (!item) return;
      const title = event.querySelector("b");
      const time = event.querySelector("span");
      if (title) title.textContent = item[0];
      if (time) time.textContent = item[1];
    });
  }

  setText(".pricing .eyebrow", t.pricingEyebrow);
  setText(".pricing h2", t.pricingTitle);
  setText(".pricing > div:first-child p:last-child", t.pricingText);
  if (t.soon) {
    setText(".soon .eyebrow", t.soon.eyebrow);
    setText(".soon h2", t.soon.title);
    document.querySelectorAll(".soon-list div").forEach((item, index) => {
      const soonItem = t.soon.items[index];
      if (!soonItem) return;
      const title = item.querySelector("b");
      const text = item.querySelector("span");
      if (title) title.textContent = soonItem[0];
      if (text) text.textContent = soonItem[1];
    });
  }
  fillPlanCard("monthly", {
    title: t.plans.monthlyTitle,
    description: t.plans.monthlyDescription,
    currency: t.plans.monthlyCurrency,
    price: t.plans.monthlyPrice,
    period: t.plans.monthlyPeriod,
    badge: t.plans.monthlyBadge,
  });
  fillPlanCard("annual", {
    title: t.plans.annualTitle,
    description: t.plans.annualDescription,
    currency: t.plans.annualCurrency,
    price: t.plans.annualPrice,
    period: t.plans.annualPeriod,
    badge: t.plans.annualBadge,
  });
  setText(".plan-ribbon", t.plans.popular);
  setText("#price-modal-title", t.modalTitle);
  setText("[data-price-modal-copy]", t.modalText);
  setText('.lead-form label:nth-of-type(1) span', t.name);
  setText('.lead-form label:nth-of-type(2) span', t.email);
  setText('.lead-form label:nth-of-type(3) span', t.phone);
  document.querySelector('input[name="name"]')?.setAttribute("placeholder", t.namePlaceholder);
  document.querySelector('input[name="email"]')?.setAttribute("placeholder", t.emailPlaceholder);
  document.querySelector('input[name="phone"]')?.setAttribute("placeholder", t.phonePlaceholder);
  setText(".lead-form button", t.unlock);
  document.querySelectorAll("[data-plan-button]").forEach((button) => {
    button.textContent = `🔒 ${t.unlock}`;
  });
  setText("#testimonials h2", t.testimonialsTitle);
  if (t.testimonials) {
    const slides = Array.from(document.querySelectorAll("[data-testimonial-slide]"));
    slides.forEach((slide, index) => {
      const testimonial = t.testimonials[index];
      if (!testimonial) return;
      const name = slide.querySelector(".testimonial-copy strong");
      const role = slide.querySelector(".testimonial-copy span");
      const quote = slide.querySelector(".testimonial-copy p");
      if (name) name.textContent = testimonial.name;
      if (role) role.textContent = testimonial.role;
      if (quote) quote.textContent = testimonial.quote;
      slide.querySelector("img")?.setAttribute("alt", testimonial.name);
    });
  }
  setText(".faq h2", t.faqTitle);
  if (t.faqs) {
    const faqItems = Array.from(document.querySelectorAll(".faq details"));
    faqItems.forEach((item, index) => {
      const faq = t.faqs[index];
      if (!faq) return;
      const summary = item.querySelector("summary");
      const answer = item.querySelector("p");
      if (summary) summary.textContent = faq.question;
      if (answer) answer.textContent = faq.answer;
    });
  }

  // Update footer links and content dynamically based on active locale
  const privacyLink = document.querySelector('a[href="/privacidade"], a[href="/privacy"]');
  if (privacyLink) {
    privacyLink.setAttribute("href", locale === "en-us" ? "/privacy" : "/privacidade");
    privacyLink.textContent = locale === "en-us" ? "Privacy policy" : "Politica de privacidade";
  }
  const termsLink = document.querySelector('a[href="/termos"], a[href="/terms"]');
  if (termsLink) {
    termsLink.setAttribute("href", locale === "en-us" ? "/terms" : "/termos");
    termsLink.textContent = locale === "en-us" ? "Terms of use" : "Termos de uso";
  }

  // Update footer text elements
  setText(".footer-links p", t.footerSupport);
  const footerSpans = document.querySelectorAll(".footer-bottom span");
  if (footerSpans[0] && t.footerRights) footerSpans[0].textContent = t.footerRights;
  if (footerSpans[1] && t.footerSecurity) footerSpans[1].textContent = t.footerSecurity;
}

function setupTestimonialSlider() {
  const slider = document.querySelector("[data-testimonial-slider]");
  if (!slider) return;
  const slides = Array.from(slider.querySelectorAll("[data-testimonial-slide]"));
  const dotsWrap = slider.querySelector("[data-testimonial-dots]");
  const prevButton = slider.querySelector("[data-testimonial-prev]");
  const nextButton = slider.querySelector("[data-testimonial-next]");
  const stage = slider.querySelector("[data-testimonial-stage]");
  if (!slides.length || !dotsWrap) return;

  let index = 0;
  let timer = null;

  const dots = slides.map((_, dotIndex) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "testimonial-dot";
    dot.setAttribute("aria-label", `Depoimento ${dotIndex + 1}`);
    dot.addEventListener("click", () => {
      goTo(dotIndex);
      restart();
    });
    dotsWrap.appendChild(dot);
    return dot;
  });

  function goTo(nextIndex) {
    index = (nextIndex + slides.length) % slides.length;
    const prev = (index - 1 + slides.length) % slides.length;
    const next = (index + 1) % slides.length;
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === index);
      slide.classList.toggle("is-prev", slideIndex === prev);
      slide.classList.toggle("is-next", slideIndex === next);
      slide.setAttribute("aria-hidden", String(slideIndex !== index));
    });
    dots.forEach((dot, dotIndex) => dot.setAttribute("aria-current", String(dotIndex === index)));
    syncStageHeight();
  }

  function syncStageHeight() {
    if (!stage) return;
    window.requestAnimationFrame(() => {
      const active = slides[index];
      const minimum = window.matchMedia("(max-width: 620px)").matches ? 430 : 340;
      stage.style.height = `${Math.max(active.offsetHeight + 34, minimum)}px`;
    });
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  function restart() {
    stop();
    timer = window.setInterval(() => goTo(index + 1), 5200);
  }

  prevButton?.addEventListener("click", () => {
    goTo(index - 1);
    restart();
  });
  nextButton?.addEventListener("click", () => {
    goTo(index + 1);
    restart();
  });
  slider.addEventListener("mouseenter", stop);
  window.addEventListener("resize", syncStageHeight);
  window.addEventListener("load", syncStageHeight);
  slider.addEventListener("mouseleave", restart);

  goTo(0);
  restart();
}

function setupLeadGate(locale) {
  const form = document.querySelector("[data-lead-form]");
  const priceCard = document.querySelector("[data-price-card]");
  const modal = document.querySelector("[data-price-modal]");
  const modalPanel = document.querySelector(".price-modal-panel");
  const modalCloseButtons = document.querySelectorAll("[data-price-modal-close]");
  const storageKey = `flowme_lp_price_unlocked_${locale}`;
  const phone = form?.querySelector('input[name="phone"]');
  const intervalInput = form?.querySelector('input[name="interval"]');
  const planButtons = document.querySelectorAll("[data-plan-button]");
  const planTabs = document.querySelectorAll("[data-plan-tab]");
  let activeLead = readStoredLead(locale);

  function selectInterval(interval) {
    if (!intervalInput) return;
    intervalInput.value = interval || "annual";
    document.querySelectorAll("[data-plan-card]").forEach((card) => {
      card.classList.toggle("is-selected", card.getAttribute("data-interval") === intervalInput.value);
    });
    planTabs.forEach((tab) => {
      tab.setAttribute("aria-selected", String(tab.getAttribute("data-interval") === intervalInput.value));
    });
  }

  function selectedLead() {
    return { ...(activeLead || {}), interval: intervalInput?.value || activeLead?.interval || "annual" };
  }

  function refreshActiveLead() {
    if (activeLead?.lead_token) return activeLead;
    const storedLead = readStoredLead(locale);
    if (storedLead?.lead_token) activeLead = storedLead;
    return activeLead;
  }

  function goToCheckout() {
    const lead = refreshActiveLead();
    if (!lead?.lead_token) return false;
    window.location.assign(checkoutUrl(locale, selectedLead()));
    return true;
  }

  function openModal(interval) {
    selectInterval(interval);
    showFieldErrors({});
    formFeedback("", "");
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      modalPanel?.focus();
      form?.querySelector('input[name="name"]')?.focus({ preventScroll: true });
    });
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  function revealPrices(lead) {
    if (!lead?.lead_token) {
      formFeedback(copy[locale].submitError, "error");
      return false;
    }
    activeLead = lead;
    priceCard?.classList.add("is-unlocked");
    document.querySelectorAll("[data-plan-card]").forEach((card) => card.classList.add("is-unlocked"));
    planButtons.forEach((button) => {
      button.textContent = copy[locale].guarantee;
      button.classList.add("is-guarantee");
    });
    closeModal();
    return true;
  }

  selectInterval(activeLead?.interval || intervalInput?.value || "annual");
  if (window.localStorage.getItem(storageKey) === "true" && activeLead?.lead_token) {
    revealPrices(activeLead);
  } else if (window.localStorage.getItem(storageKey) === "true" && !activeLead?.lead_token) {
    window.localStorage.removeItem(storageKey);
  }

  planButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const interval = button.getAttribute("data-interval") || "annual";
      selectInterval(interval);
      if (button.classList.contains("is-guarantee") || priceCard?.classList.contains("is-unlocked")) {
        if (goToCheckout()) return;
        window.localStorage.removeItem(storageKey);
        priceCard?.classList.remove("is-unlocked");
        document.querySelectorAll("[data-plan-card]").forEach((card) => card.classList.remove("is-unlocked"));
        planButtons.forEach((planButton) => {
          planButton.classList.remove("is-guarantee");
          planButton.textContent = `🔒 ${copy[locale].unlock}`;
        });
        openModal(interval);
        return;
      }
      openModal(interval);
    });
  });

  planTabs.forEach((tab) => {
    tab.addEventListener("click", () => selectInterval(tab.getAttribute("data-interval") || "annual"));
  });

  modalCloseButtons.forEach((button) => button.addEventListener("click", closeModal));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal && !modal.hidden) closeModal();
  });

  phone?.addEventListener("input", () => {
    phone.value = formatPhone(phone.value, form?.elements.country?.value === "BR" ? "pt-br" : "en-us");
  });
  form?.elements.country?.addEventListener("change", () => {
    phone.value = formatPhone(phone.value, form.elements.country.value === "BR" ? "pt-br" : "en-us");
  });

  form?.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      input.setAttribute("aria-invalid", "false");
      const error = document.querySelector(`[data-field-error="${input.name}"]`);
      if (error) error.textContent = "";
      formFeedback("", "");
    });
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const t = copy[locale];
    const errors = validateLead(form, locale);
    showFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      formFeedback("", "error");
      return;
    }
    const payload = Object.fromEntries(new FormData(form).entries());
    const selectedCountry = form.elements.country?.selectedOptions?.[0];
    const dial = selectedCountry?.dataset?.dial || "+55";
    payload.phone = `${dial}${String(payload.phone || "").replace(/\D/g, "")}`;
    const button = form.querySelector("button");
    const previousLabel = button?.textContent || t.unlock;
    if (button) {
      button.textContent = t.sending;
      button.disabled = true;
    }
    formFeedback("", "");
    try {
      const result = await marketingPost("/api/marketing/leads", {
        ...baseMarketingPayload(locale),
        ...payload,
        metadata: { price_gate: true },
      });
      if (!result.lead_token) throw new Error("missing_lead_token");
      const lead = {
        ...payload,
        lead_id: result.lead_id,
        lead_token: result.lead_token,
        locale,
        capturedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(storageKey, "true");
      window.localStorage.setItem(`flowme_lp_lead_${locale}`, JSON.stringify(lead));
      if (revealPrices(lead)) formFeedback(t.submitSuccess, "success");
    } catch {
      formFeedback(t.submitError, "error");
    } finally {
      if (button) {
        button.textContent = previousLabel;
        button.disabled = false;
      }
    }
  });
}

function setupSequencedWhatsAppChat(selector, cycleMs = 35000) {
  const scroll = document.querySelector(selector);
  const typing = scroll?.querySelector(".hero-wa-typing");
  const bubbles = scroll ? [...scroll.querySelectorAll(".hero-wa-bubble")] : [];
  if (!scroll || !typing || !bubbles.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  scroll.classList.add("js-seq");

  const scrollToLatest = () => {
    requestAnimationFrame(() => {
      scroll.scrollTop = scroll.scrollHeight;
    });
  };

  const steps = [];
  let at = 80;
  bubbles.forEach((bubble) => {
    if (bubble.classList.contains("bot")) {
      steps.push({
        at,
        run: () => {
          typing.classList.add("is-shown");
          scrollToLatest();
        },
      });
      at += 520;
      steps.push({
        at,
        run: () => {
          typing.classList.remove("is-shown");
          bubble.classList.add("is-shown");
          scrollToLatest();
        },
      });
      at += 760;
    } else {
      steps.push({
        at,
        run: () => {
          bubble.classList.add("is-shown");
          scrollToLatest();
        },
      });
      at += 440;
    }
  });

  let timers = [];
  function runCycle() {
    timers.forEach(clearTimeout);
    timers = [];
    typing.classList.remove("is-shown");
    bubbles.forEach((bubble) => bubble.classList.remove("is-shown"));
    scroll.scrollTop = 0;
    steps.forEach((step) => timers.push(setTimeout(step.run, step.at)));
  }

  runCycle();
  setInterval(runCycle, cycleMs);
}

function setupHeroChat() {
  setupSequencedWhatsAppChat(".hero-chat-scroll", 35000);
  setupSequencedWhatsAppChat(".finance-chat-scroll", 12000);
}

function setupSpaceBackground() {
  if (document.querySelector(".space-backdrop")) return;
  const wrap = document.createElement("div");
  wrap.className = "space-backdrop";
  wrap.setAttribute("aria-hidden", "true");
  const canvas = document.createElement("canvas");
  wrap.appendChild(canvas);
  document.body.prepend(wrap);

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let rows = 0;
  let cols = 0;
  let tick = 0;
  let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let particles = [];
  const pointer = { x: 0, y: 0, active: false };

  const createParticles = () => {
    particles = [];
    const spacing = Math.max(20, Math.min(30, width / 54));
    cols = Math.ceil(width / spacing) + 5;
    rows = Math.ceil(height / spacing) + 5;
    const offsetX = (width - (cols - 1) * spacing) / 2;
    const offsetY = (height - (rows - 1) * spacing) / 2;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const wave = Math.sin(col * 0.55) * 10 + Math.cos(row * 0.42) * 8;
        const x = offsetX + col * spacing + Math.sin(row * 1.7 + col) * 5;
        const y = offsetY + row * spacing + wave;
        const colorBand = (row / Math.max(rows - 1, 1)) * 56 + (col / Math.max(cols - 1, 1)) * 34;
        particles.push({
          x,
          y,
          baseX: x,
          baseY: y,
          vx: 0,
          vy: 0,
          size: 0.7 + ((row * 17 + col * 13) % 10) / 12,
          hue: 178 + colorBand,
          row,
          col,
        });
      }
    }
  };

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    pointer.x = width * 0.72;
    pointer.y = height * 0.42;
    createParticles();
  };

  const updatePointer = (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  };

  const stopPointer = () => {
    pointer.active = false;
  };

  const drawParticle = (particle) => {
    const glow = pointer.active ? 0.78 : 0.54;
    context.beginPath();
    context.fillStyle = `hsla(${particle.hue}, 88%, 68%, ${glow})`;
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();
  };

  const drawConnection = (particle, neighbor) => {
    if (!neighbor) return;
    const distanceX = particle.x - neighbor.x;
    const distanceY = particle.y - neighbor.y;
    const distance = Math.hypot(distanceX, distanceY);
    if (distance > 46) return;
    const alpha = Math.max(0, 1 - distance / 46) * 0.2;
    context.beginPath();
    context.strokeStyle = `hsla(${(particle.hue + neighbor.hue) / 2}, 88%, 66%, ${alpha})`;
    context.lineWidth = 0.75;
    context.moveTo(particle.x, particle.y);
    context.lineTo(neighbor.x, neighbor.y);
    context.stroke();
  };

  const drawSingularity = (radius) => {
    const x = pointer.x;
    const y = pointer.y;
    const pulse = 1 + Math.sin(tick * 4.4) * 0.035;
    const coreRadius = Math.max(18, Math.min(26, radius * 0.12)) * pulse;
    const diskRadius = Math.max(62, Math.min(92, radius * 0.42)) * pulse;
    const tilt = 0.34;

    const halo = context.createRadialGradient(x, y, coreRadius * 0.2, x, y, diskRadius * 2.15);
    halo.addColorStop(0, "rgba(2, 6, 23, 0.92)");
    halo.addColorStop(0.18, "rgba(14, 21, 46, 0.68)");
    halo.addColorStop(0.34, "rgba(94, 234, 212, 0.14)");
    halo.addColorStop(0.58, "rgba(129, 140, 248, 0.10)");
    halo.addColorStop(1, "rgba(3, 5, 12, 0)");
    context.save();
    context.globalCompositeOperation = "lighter";
    context.fillStyle = halo;
    context.fillRect(x - diskRadius * 2.15, y - diskRadius * 2.15, diskRadius * 4.3, diskRadius * 4.3);

    context.translate(x, y);
    context.rotate(Math.sin(tick * 0.9) * 0.08);

    for (let ring = 0; ring < 4; ring += 1) {
      const ringRadius = diskRadius * (0.72 + ring * 0.13);
      const ringAlpha = 0.34 - ring * 0.055;
      const start = tick * (0.9 + ring * 0.21) + ring * 1.15;
      const end = start + Math.PI * (1.25 + ring * 0.12);
      const gradient = context.createLinearGradient(-ringRadius, 0, ringRadius, 0);
      gradient.addColorStop(0, `rgba(94, 234, 212, ${ringAlpha * 0.45})`);
      gradient.addColorStop(0.46, `rgba(129, 140, 248, ${ringAlpha})`);
      gradient.addColorStop(1, `rgba(244, 114, 182, ${ringAlpha * 0.62})`);
      context.save();
      context.rotate(ring % 2 === 0 ? -0.3 : 0.22);
      context.scale(1, tilt + ring * 0.026);
      context.beginPath();
      context.strokeStyle = gradient;
      context.lineWidth = 1.4 - ring * 0.12;
      context.arc(0, 0, ringRadius, start, end);
      context.stroke();
      context.restore();
    }

    context.save();
    context.rotate(-0.2);
    context.scale(1.18, 0.32);
    const diskGradient = context.createLinearGradient(-diskRadius, 0, diskRadius, 0);
    diskGradient.addColorStop(0, "rgba(94, 234, 212, 0)");
    diskGradient.addColorStop(0.22, "rgba(94, 234, 212, 0.42)");
    diskGradient.addColorStop(0.52, "rgba(255, 255, 255, 0.58)");
    diskGradient.addColorStop(0.76, "rgba(168, 85, 247, 0.46)");
    diskGradient.addColorStop(1, "rgba(244, 114, 182, 0)");
    context.beginPath();
    context.strokeStyle = diskGradient;
    context.lineWidth = 3.2;
    context.arc(0, 0, diskRadius * 0.74, 0, Math.PI * 2);
    context.stroke();
    context.restore();

    context.globalCompositeOperation = "source-over";
    const core = context.createRadialGradient(0, 0, 0, 0, 0, coreRadius * 1.65);
    core.addColorStop(0, "rgba(0, 0, 0, 1)");
    core.addColorStop(0.5, "rgba(1, 5, 16, 0.98)");
    core.addColorStop(0.72, "rgba(15, 23, 42, 0.72)");
    core.addColorStop(1, "rgba(94, 234, 212, 0)");
    context.beginPath();
    context.fillStyle = core;
    context.arc(0, 0, coreRadius * 1.65, 0, Math.PI * 2);
    context.fill();

    context.beginPath();
    context.strokeStyle = "rgba(226, 232, 240, 0.58)";
    context.lineWidth = 0.8;
    context.arc(0, 0, coreRadius * 1.04, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  };

  const render = () => {
    tick += reducedMotion ? 0.002 : 0.008;
    context.clearRect(0, 0, width, height);

    const gradient = context.createRadialGradient(
      width * 0.5,
      height * 0.48,
      0,
      width * 0.5,
      height * 0.48,
      Math.max(width, height) * 0.78
    );
    gradient.addColorStop(0, "rgba(18, 24, 46, 0.72)");
    gradient.addColorStop(0.45, "rgba(7, 10, 22, 0.72)");
    gradient.addColorStop(1, "rgba(3, 5, 12, 0.98)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    const fieldRadius = Math.min(230, Math.max(150, width * 0.16));
    const fieldRadiusSq = fieldRadius * fieldRadius;

    for (const particle of particles) {
      const ambientX = Math.sin(tick + particle.row * 0.27 + particle.col * 0.1) * 10;
      const ambientY = Math.cos(tick * 0.84 + particle.col * 0.22) * 8;
      let targetX = particle.baseX + ambientX;
      let targetY = particle.baseY + ambientY;

      const dx = particle.x - pointer.x;
      const dy = particle.y - pointer.y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq < fieldRadiusSq) {
        const distance = Math.max(Math.sqrt(distanceSq), 1);
        const force = (1 - distance / fieldRadius) ** 2;
        const angle = Math.atan2(dy, dx);
        const orbit = angle + Math.PI * 0.5;
        const eventHorizon = Math.max(34, fieldRadius * 0.16);
        const inward = distance < eventHorizon ? -distance * 0.34 : -fieldRadius * 0.46;
        const orbital = 68 + Math.sin(tick * 1.6 + particle.row * 0.22 + particle.col * 0.14) * 10;
        const shear = Math.max(0, 1 - Math.abs(distance - eventHorizon * 1.45) / (fieldRadius * 0.62));
        targetX += Math.cos(angle) * force * inward + Math.cos(orbit) * force * orbital + Math.cos(angle) * shear * 10;
        targetY += Math.sin(angle) * force * inward + Math.sin(orbit) * force * orbital + Math.sin(angle) * shear * 10;
      }

      particle.vx += (targetX - particle.x) * 0.045;
      particle.vy += (targetY - particle.y) * 0.045;
      particle.vx *= reducedMotion ? 0.68 : 0.86;
      particle.vy *= reducedMotion ? 0.68 : 0.86;
      particle.x += particle.vx;
      particle.y += particle.vy;
    }

    context.save();
    context.globalCompositeOperation = "lighter";

    for (const particle of particles) {
      const index = particle.row * cols + particle.col;
      drawConnection(particle, particles[index + 1]);
      drawConnection(particle, particles[index + cols]);
    }

    for (const particle of particles) {
      drawParticle(particle);
    }

    const pointerGlow = context.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, fieldRadius * 1.1);
    pointerGlow.addColorStop(0, pointer.active ? "rgba(94, 234, 212, 0.22)" : "rgba(129, 140, 248, 0.08)");
    pointerGlow.addColorStop(0.48, pointer.active ? "rgba(129, 140, 248, 0.12)" : "rgba(129, 140, 248, 0.04)");
    pointerGlow.addColorStop(1, "rgba(3, 5, 12, 0)");
    context.fillStyle = pointerGlow;
    context.fillRect(pointer.x - fieldRadius * 1.1, pointer.y - fieldRadius * 1.1, fieldRadius * 2.2, fieldRadius * 2.2);
    drawSingularity(fieldRadius);
    context.restore();

    const veil = context.createLinearGradient(0, 0, 0, height);
    veil.addColorStop(0, "rgba(3, 5, 12, 0.16)");
    veil.addColorStop(0.48, "rgba(3, 5, 12, 0.34)");
    veil.addColorStop(1, "rgba(3, 5, 12, 0.78)");
    context.fillStyle = veil;
    context.fillRect(0, 0, width, height);

    window.requestAnimationFrame(render);
  };

  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => {
    reducedMotion = event.matches;
  });
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", updatePointer, { passive: true });
  window.addEventListener("pointerdown", updatePointer, { passive: true });
  window.addEventListener("pointerleave", stopPointer);

  resize();
  render();
}

function recordLandingVisit(locale) {
  marketingPost("/api/marketing/visits", {
    ...baseMarketingPayload(locale),
    surface: "landing",
    metadata: { page_title: document.title },
  }).catch(() => {});
}

const locale = getLocale();
applyLocale(locale);
setupLeadGate(locale);
setupTestimonialSlider();
setupHeroChat();
setupSpaceBackground();
recordLandingVisit(locale);
