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
    plans: {
      monthlyTitle: "Monthly",
      monthlyDescription: "Full Flow Me Pro without annual commitment. Ideal for testing with your real routine.",
      monthlyCurrency: "US$",
      monthlyPrice: "11.90",
      monthlyPeriod: "/mo",
      monthlyBadge: "Flexible",
      annualTitle: "Annual",
      annualDescription: "Best price to centralize calendar, tasks, WhatsApp, finance, notes and Balys AI.",
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
    plans: {
      monthlyTitle: "Mensal",
      monthlyDescription: "Flow Me Pro completo, sem compromisso anual. Ideal para testar com rotina real.",
      monthlyCurrency: "R$",
      monthlyPrice: "59,90",
      monthlyPeriod: "/mes",
      monthlyBadge: "Flexivel",
      annualTitle: "Anual",
      annualDescription: "Melhor preco para centralizar agenda, tarefas, WhatsApp, finanças, notas e Balys AI.",
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
  const digits = phone.value.replace(/\D/g, "");
  const errors = {};
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
  const phoneOk = locale === "pt-br" ? digits.length >= 10 : digits.length === 10;

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
  setText(".hero .eyebrow", t.eyebrow);
  setText(".hero h1", t.h1);
  setText(".hero-text", t.hero);
  setText(".hero-actions .primary-cta", t.primary);
  setText(".hero-actions .secondary-cta", t.secondary);
  setTexts(".hero-pills span", t.pills);

  setText(".pricing .eyebrow", t.pricingEyebrow);
  setText(".pricing h2", t.pricingTitle);
  setText(".pricing > div:first-child p:last-child", t.pricingText);
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
  setTexts(".testimonial-grid article p", [t.testimonial1, t.testimonial2]);
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
  let activeLead = readStoredLead(locale);

  function selectInterval(interval) {
    if (!intervalInput) return;
    intervalInput.value = interval || "annual";
    document.querySelectorAll("[data-plan-card]").forEach((card) => {
      card.classList.toggle("is-selected", card.getAttribute("data-interval") === intervalInput.value);
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

  modalCloseButtons.forEach((button) => button.addEventListener("click", closeModal));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal && !modal.hidden) closeModal();
  });

  phone?.addEventListener("input", () => {
    phone.value = formatPhone(phone.value, locale);
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
