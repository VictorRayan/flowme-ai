const marketingApiBase = window.FlowMeMarketingApiBase || "https://app.flow-me.online";

const copy = {
  "en-us": {
    title: "Flow Me | Your personal Jarvis",
    description:
      "Flow Me and Balys AI centralize calendar, tasks, WhatsApp, Gmail, Slack, notes, checklists and priorities in a personal Jarvis.",
    nav: ["Balys AI", "Features", "WhatsApp", "Plans"],
    headerCta: "Start now",
    eyebrow: "Personal AI for work, routine and real life",
    h1: "A personal Jarvis. Inside your day.",
    hero:
      "Balys AI understands your messages, calendar, tasks, Slack, Gmail, notes and reminders. You speak. It organizes. You execute what matters.",
    primary: "Unlock Flow Me Pro",
    secondary: "See features",
    pills: ["Capture by voice", "Chat on WhatsApp", "Plan in your dashboard"],
    pricingEyebrow: "Special offer",
    pricingTitle: "One plan to centralize your life.",
    pricingText:
      "Balys AI, calendar, tasks, checklists, notes, reviews, connectors and reminders in one subscription.",
    lockedTitle: "Unlock the special price",
    lockedText: "Fill in your details to see the offer and go to checkout.",
    name: "Name",
    namePlaceholder: "Your name",
    email: "Email",
    emailPlaceholder: "you@email.com",
    phone: "Phone",
    phonePlaceholder: "+1 (555) 000-0000",
    unlock: "See price",
    sending: "Sending...",
    invalidName: "Enter your name.",
    invalidEmail: "Enter a valid email.",
    invalidPhone: "Enter a valid WhatsApp number.",
    submitError: "We could not unlock the price. Try again.",
    submitSuccess: "Price unlocked.",
    price: "US$ 7.90",
    priceNote: "/month billed yearly",
    buy: "Buy now",
    secure: "Secure purchase. Cancel anytime.",
    testimonialsTitle: "Real routines. Less noise.",
    testimonial1:
      '"I work in Revenue Operations and Flow Me helps me execute what matters. It connects Slack, Gmail, tasks and personal life. I get the right signals and stop living in firefighting mode."',
    testimonial2:
      '"I can organize pets, groceries, errands, study, English class, therapy and personal commitments in the same day without losing my mind. I really want the mobile app."',
  },
  "pt-br": {
    title: "Flow Me | Seu Jarvis pessoal",
    description:
      "Flow Me e Balys AI centralizam calendario, tarefas, WhatsApp, Gmail, Slack, notas, checklists e prioridades em um Jarvis pessoal.",
    nav: ["Balys AI", "Features", "WhatsApp", "Planos"],
    headerCta: "Comecar agora",
    eyebrow: "IA pessoal para trabalho, rotina e vida real",
    h1: "Um Jarvis pessoal. Direto no seu dia.",
    hero:
      "Balys AI entende suas mensagens, agenda, tarefas, Slack, Gmail, notas e lembretes. Voce fala. Ele organiza. Voce executa o que importa.",
    primary: "Desbloquear Flow Me Pro",
    secondary: "Ver funcionalidades",
    pills: ["Registre por audio", "Converse no WhatsApp", "Planeje no painel"],
    pricingEyebrow: "Oferta especial",
    pricingTitle: "Um plano para centralizar sua vida.",
    pricingText:
      "Balys AI, agenda, tarefas, checklists, notas, revisoes, conectores e lembretes em uma assinatura.",
    lockedTitle: "Desbloqueie o preco especial",
    lockedText: "Preencha seus dados para ver a oferta e ir para o checkout.",
    name: "Nome",
    namePlaceholder: "Seu nome",
    email: "Email",
    emailPlaceholder: "voce@email.com",
    phone: "Telefone",
    phonePlaceholder: "(11) 99999-9999",
    unlock: "Ver preco",
    sending: "Enviando...",
    invalidName: "Informe seu nome.",
    invalidEmail: "Informe um email valido.",
    invalidPhone: "Informe um WhatsApp valido.",
    submitError: "Nao conseguimos desbloquear o preco. Tente novamente.",
    submitSuccess: "Preco desbloqueado.",
    price: "R$ 39,90",
    priceNote: "/mes no anual",
    buy: "Adquirir agora",
    secure: "Compra segura. Cancele quando quiser.",
    testimonialsTitle: "Rotinas reais. Menos ruido.",
    testimonial1:
      '"Trabalho com Revenue Operations e o Flow Me me ajuda a executar o que importa. Ele cruza Slack, Gmail, tarefas e vida pessoal. Recebo os sinais certos e paro de viver apagando incendio."',
    testimonial2:
      '"Consigo organizar cachorros, compras, rua, estudo, ingles, ballet, terapia e compromissos pessoais. Tudo no mesmo dia, sem ficar maluca. Quero muito a versao mobile."',
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

function checkoutUrl(locale) {
  const url = new URL(`${marketingApiBase}/app/checkout`);
  url.searchParams.set("locale", apiLocale(locale));
  url.searchParams.set("source", locale === "en-us" ? "lp_en-us" : "lp_pt-br");
  return url.toString();
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
  const digits = phone.value.replace(/\D/g, "");
  const errors = [];
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
  const phoneOk = locale === "pt-br" ? digits.length >= 10 : digits.length === 10;

  name.setAttribute("aria-invalid", String(name.value.trim().length < 2));
  email.setAttribute("aria-invalid", String(!emailOk));
  phone.setAttribute("aria-invalid", String(!phoneOk));
  if (name.value.trim().length < 2) errors.push(t.invalidName);
  if (!emailOk) errors.push(t.invalidEmail);
  if (!phoneOk) errors.push(t.invalidPhone);
  return errors;
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

function setTexts(selector, values) {
  document.querySelectorAll(selector).forEach((node, index) => {
    if (values[index]) node.textContent = values[index];
  });
}

function applyLocale(locale) {
  const t = copy[locale];
  document.documentElement.lang = locale === "en-us" ? "en-US" : "pt-BR";
  document.title = t.title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", t.description);

  setTexts(".nav a", t.nav);
  setText(".header-cta", t.headerCta);
  setText(".hero .eyebrow", t.eyebrow);
  setText(".hero h1", t.h1);
  setText(".hero-text", t.hero);
  setText(".hero-actions .primary-cta", t.primary);
  setText(".hero-actions .secondary-cta", t.secondary);
  setTexts(".hero-pills span", t.pills);

  setText(".pricing .eyebrow", t.pricingEyebrow);
  setText(".pricing h2", t.pricingTitle);
  setText(".pricing > div:first-child p:last-child", t.pricingText);
  setText(".price-locked h3", t.lockedTitle);
  setText(".price-locked > p", t.lockedText);
  setText('.lead-form label:nth-child(1) span', t.name);
  setText('.lead-form label:nth-child(2) span', t.email);
  setText('.lead-form label:nth-child(3) span', t.phone);
  document.querySelector('input[name="name"]')?.setAttribute("placeholder", t.namePlaceholder);
  document.querySelector('input[name="email"]')?.setAttribute("placeholder", t.emailPlaceholder);
  document.querySelector('input[name="phone"]')?.setAttribute("placeholder", t.phonePlaceholder);
  setText(".lead-form button", t.unlock);
  setText("[data-price-value]", t.price);
  setText("[data-price-note]", t.priceNote);
  setText(".price-unlocked .primary-cta", t.buy);
  document.querySelector(".price-unlocked .primary-cta")?.setAttribute("href", checkoutUrl(locale));
  setText(".price-unlocked p", t.secure);
  setText("#testimonials h2", t.testimonialsTitle);
  setTexts(".testimonial-grid article p", [t.testimonial1, t.testimonial2]);
}

function setupLeadGate(locale) {
  const form = document.querySelector("[data-lead-form]");
  const locked = document.querySelector("[data-price-locked]");
  const unlocked = document.querySelector("[data-price-unlocked]");
  const storageKey = `flowme_lp_price_unlocked_${locale}`;
  const phone = form?.querySelector('input[name="phone"]');

  function unlock() {
    if (!locked || !unlocked) return;
    locked.hidden = true;
    unlocked.hidden = false;
  }

  if (window.localStorage.getItem(storageKey) === "true") unlock();

  phone?.addEventListener("input", () => {
    phone.value = formatPhone(phone.value, locale);
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const t = copy[locale];
    const errors = validateLead(form, locale);
    if (errors.length > 0) {
      formFeedback(errors[0], "error");
      return;
    }
    const payload = Object.fromEntries(new FormData(form).entries());
    const button = form.querySelector("button");
    const previousLabel = button?.textContent || t.unlock;
    if (button) {
      button.textContent = t.sending;
      button.disabled = true;
    }
    formFeedback("", "");
    try {
      await marketingPost("/api/marketing/leads", {
        ...baseMarketingPayload(locale),
        ...payload,
        metadata: { price_gate: true },
      });
      window.localStorage.setItem(storageKey, "true");
      window.localStorage.setItem(`flowme_lp_lead_${locale}`, JSON.stringify({
        ...payload,
        locale,
        capturedAt: new Date().toISOString(),
      }));
      formFeedback(t.submitSuccess, "success");
      unlock();
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
recordLandingVisit(locale);
