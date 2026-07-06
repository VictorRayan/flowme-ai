const marketingApiBase = window.FlowMeMarketingApiBase || "https://app.flow-me.online";

const copy = {
  "en-us": {
    title: "Flow Me | Personal assistant on WhatsApp",
    description:
      "Centralize WhatsApp, calendar, reminders, notes, finance, documents and work with your personal assistant on WhatsApp.",
    nav: ["Testimonials", "Plans"],
    headerCta: "Start now",
    eyebrow: "AI on WhatsApp for routine, work and real life",
    h1: 'Get into flow with <em>your personal assistant on WhatsApp.</em>',
    hero:
      "Your personal assistant to centralize WhatsApp, calendar, reminders, notes, finance, documents and work. Speak your way. Flow Me records, organizes and reminds you of the next step.",
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
    nav: ["Depoimentos", "Planos"],
    headerCta: "Comecar agora",
    eyebrow: "IA no WhatsApp para rotina, trabalho e vida real",
    h1: 'Entre em flow com <em>seu assistente pessoal no seu WhatsApp.</em>',
    hero:
      "Seu assistente pessoal para centralizar WhatsApp, agenda, lembretes, notas, financas, documentos e trabalho. Voce fala do seu jeito. O Flow Me registra, organiza e lembra o proximo passo.",
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
  if (lead?.email) url.searchParams.set("email", lead.email);
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
      const app = notification.querySelector("span");
      const title = notification.querySelector("strong");
      const body = notification.querySelector("p");
      const time = notification.querySelector("time");
      if (app) app.textContent = item.app;
      if (title) title.textContent = item.title;
      if (body) body.textContent = item.body;
      if (time) time.textContent = item.time;
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

function setupHeroChat() {
  const scroll = document.querySelector(".hero-chat-scroll");
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
  setInterval(runCycle, 35000);
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
recordLandingVisit(locale);
