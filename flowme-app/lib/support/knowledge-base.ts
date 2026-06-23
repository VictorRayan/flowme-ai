export type SupportKnowledgeSection = {
  key: string;
  title: string;
  keywords: string[];
  body: string;
};

export const SUPPORT_KNOWLEDGE_BASE: SupportKnowledgeSection[] = [
  { key: 'getting_started', title: 'Começando no Flow Me', keywords: ['começar', 'inicio', 'início', 'onboarding', 'flow me'], body: 'Comece criando notas e conversando com o Balys. No Pro, conecte Calendar e fontes externas, defina uma meta e use Today para executar o plano do dia.' },
  { key: 'plans', title: 'Free e Pro', keywords: ['free', 'pro', 'plano', 'preço', 'assinatura'], body: 'O Free inclui Notes, Balys com créditos diários, configurações, cobrança e suporte. O Pro libera todas as áreas, canais, automações e créditos de IA ilimitados na experiência do usuário.' },
  { key: 'credits', title: 'Créditos de IA', keywords: ['crédito', 'creditos', 'créditos', 'credits', 'ia', 'ai', 'limite', 'limit'], body: 'Créditos medem o uso de IA em linguagem simples. Perguntas simples usam menos; ações com busca, arquivos ou análise usam mais. Créditos Free renovam diariamente no fuso do usuário; Pro aparece como ilimitado.' },
  { key: 'billing', title: 'Cobrança e pagamento', keywords: ['pagamento', 'cobrança', 'cartão', 'fatura', 'stripe', 'falhou'], body: 'Assinaturas web são cobradas pelo Stripe. Faturas ficam em Configurações. Para atualizar o cartão, use Atualizar pagamento. Assinaturas Apple ou Google são gerenciadas na loja correspondente.' },
  { key: 'apple_billing', title: 'Assinaturas pela Apple', keywords: ['apple', 'app store', 'ios', 'iphone'], body: 'No iPhone, a assinatura Pro é comprada e gerenciada pela App Store. A Flow Me valida o comprovante com a Apple e compartilha o acesso Pro com a mesma conta em todas as plataformas.' },
  { key: 'google_billing', title: 'Assinaturas pelo Google Play', keywords: ['google play', 'android', 'play store'], body: 'No Android, a assinatura Pro é comprada e gerenciada pelo Google Play. A Flow Me consulta o Google Play para manter o acesso da mesma conta sincronizado.' },
  { key: 'notes_balys', title: 'Notes e BalysAI', keywords: ['nota', 'notes', 'balys', 'assistente', 'chat'], body: 'Notes registra conhecimento e contexto. O Balys usa o que está disponível na sua conta para responder e agir, mas só confirma uma alteração depois que a ferramenta correspondente conclui a ação.' },
  { key: 'calendar_today', title: 'Calendar e Today', keywords: ['calendar', 'calendário', 'today', 'agenda', 'flow'], body: 'Calendar reúne compromissos conectados. Today organiza os compromissos do dia para execução, acompanhamento e registro do resultado.' },
  { key: 'goals', title: 'Metas e planos', keywords: ['meta', 'metas', 'plano', 'objetivo'], body: 'Goals transforma objetivos em marcos e rotinas. O Balys pode propor um plano, mas ações com calendário exigem uma conta Google conectada e confirmação quando houver impacto relevante.' },
  { key: 'finance', title: 'Finanças', keywords: ['finança', 'financeiro', 'despesa', 'gasto', 'receita'], body: 'Finance organiza receitas, despesas, investimentos, recorrências e saúde financeira. Recomendações são informativas e não substituem aconselhamento financeiro profissional.' },
  { key: 'reviews', title: 'Revisões e conselho', keywords: ['revisão', 'review', 'conselho', 'semanal', 'mensal'], body: 'A revisão semanal analisa execução e contexto. A mensal consolida principalmente finanças e direção para o próximo mês. O conselho usa evidências existentes e não deve inventar fatos.' },
  { key: 'council', title: 'Conselho de mentoria', keywords: ['mentoria', 'mentor', 'council'], body: 'O conselho reúne perspectivas complementares para analisar decisões e revisões. Ele trabalha com o contexto real da conta e apresenta recomendações, não fatos inventados nem decisões automáticas.' },
  { key: 'connectors', title: 'Conectores', keywords: ['conector', 'gmail', 'docs', 'sheets', 'planilha', 'drive', 'slack'], body: 'Conectores dão acesso à conta autorizada. O usuário pode pedir arquivos e mensagens por nome; IDs, OAuth e nomes de tools são detalhes internos e nunca devem ser exigidos.' },
  { key: 'whatsapp_reminders', title: 'WhatsApp e lembretes', keywords: ['whatsapp', 'lembrete', 'reminder', 'avise'], body: 'O canal WhatsApp permite conversar com o Balys e receber lembretes quando ativo. Lembretes são notificações, não tarefas nem eventos de calendário.' },
  { key: 'briefings', title: 'Briefings', keywords: ['briefing', 'resumo diário', 'notícias'], body: 'Briefings combinam agenda, contexto e tópicos escolhidos. Eles podem ser reutilizados no mesmo período para evitar custo e conteúdo duplicado.' },
  { key: 'meetings_images', title: 'Reuniões e imagens', keywords: ['reunião', 'gravar', 'transcrição', 'imagem', 'gerar'], body: 'Meeting Recording exige consentimento e permite revisar transcrição, participantes e tarefas. Image generation cria imagens no Pro a partir de uma descrição.' },
  { key: 'privacy', title: 'Privacidade e dados', keywords: ['privacidade', 'dados', 'segurança', 'excluir'], body: 'A Flow Me guarda apenas dados necessários para operar a conta e integrações. Cartões não são armazenados pela Flow Me. Nunca compartilhe segredos, tokens ou códigos de verificação no chat.' },
  { key: 'cancellation', title: 'Cancelamento', keywords: ['cancelar', 'cancelamento', 'unsubscribe', 'não quero pagar'], body: 'O suporte coleta o motivo e abre uma solicitação para revisão. Enquanto ela estiver aberta, o status aparece no Suporte. Assinaturas Apple ou Google também precisam ser gerenciadas na loja para efeito imediato.' },
  { key: 'troubleshooting', title: 'Solução de problemas', keywords: ['erro', 'problema', 'não funciona', 'falha', 'reconectar'], body: 'Confirme a conexão e tente novamente. Em falha de pagamento, atualize o método na superfície indicada. Em falha de Google ou Slack, use Reconectar conta. Problemas persistentes devem ser escalados para suporte humano.' },
];

const ENGLISH_SUPPORT_COPY: Record<string, string> = {
  getting_started: 'Start by creating notes and talking to Balys. On Pro, connect Calendar and external sources, define a goal, and use Today to execute your daily plan.',
  plans: 'Free includes Notes, Balys with daily AI credits, settings, billing, and support. Pro unlocks every area, channel, automation, and unlimited AI credits in the user experience.',
  credits: 'AI credits describe usage in simple terms. Simple questions use less; searches, files, and analysis use more. Free credits renew daily in your timezone, while Pro appears as unlimited.',
  billing: 'Web subscriptions are billed by Stripe. To fix a payment, open Settings, choose Billing, and select Update payment. Apple and Google subscriptions are managed in their respective stores.',
  apple_billing: 'On iPhone, Pro is purchased and managed through the App Store. Flow Me verifies the purchase with Apple and shares Pro access with the same account on every platform.',
  google_billing: 'On Android, Pro is purchased and managed through Google Play. Flow Me checks Google Play to keep access synchronized for the same account.',
  notes_balys: 'Notes stores knowledge and context. Balys uses the information available in your account, but only confirms a change after the corresponding action succeeds.',
  calendar_today: 'Calendar gathers connected appointments. Today organizes the day for execution, follow-up, and outcome tracking.',
  goals: 'Goals turns objectives into milestones and routines. Balys can propose a plan; calendar actions require a connected Google account and confirmation when the impact is relevant.',
  finance: 'Finance organizes income, expenses, investments, recurring items, and financial health. Guidance is informational and does not replace professional financial advice.',
  reviews: 'The weekly review examines execution and context. The monthly review consolidates finances and direction for the next month. Reviews use existing evidence and must not invent facts.',
  council: 'The mentorship council combines complementary perspectives for decisions and reviews. It uses real account context and provides recommendations, not automatic decisions.',
  connectors: 'Connectors authorize an account as a source. Ask for files and messages by name; technical IDs, OAuth terms, and tool names remain internal.',
  whatsapp_reminders: 'WhatsApp lets you talk to Balys and receive reminders when enabled. Reminders are notifications, not tasks or calendar events.',
  briefings: 'Briefings combine your schedule, context, and selected topics. A briefing may be reused during the same period to avoid duplicate content and cost.',
  meetings_images: 'Meeting Recording requires consent and lets you review transcripts, participants, and tasks. Image generation creates images from a description on Pro.',
  privacy: 'Flow Me stores the data needed to operate your account and integrations. Flow Me never stores card details. Never share secrets, tokens, or verification codes in chat.',
  cancellation: 'Support collects your reason and opens a request for review. Its status appears in Support. Apple or Google subscriptions must also be managed in the relevant store for immediate effect.',
  troubleshooting: 'First confirm the connection, then retry the action. For payment failures, update the method on the indicated billing surface. Reconnect Google or Slack when authorization fails. Escalate persistent problems to human support.',
};

const ENGLISH_SUPPORT_TITLES: Record<string, string> = {
  getting_started: 'Getting started with Flow Me', plans: 'Free and Pro', credits: 'AI credits', billing: 'Billing and payment',
  apple_billing: 'Apple subscriptions', google_billing: 'Google Play subscriptions', notes_balys: 'Notes and BalysAI',
  calendar_today: 'Calendar and Today', goals: 'Goals and plans', finance: 'Finance', reviews: 'Reviews', council: 'Mentorship council',
  connectors: 'Connectors', whatsapp_reminders: 'WhatsApp and reminders', briefings: 'Briefings', meetings_images: 'Meetings and images',
  privacy: 'Privacy and data', cancellation: 'Cancellation', troubleshooting: 'Troubleshooting',
};

export type SupportQuestionKey = 'manage_subscription' | 'payment_and_recurrence' | 'cancel_subscription';

const FUNNEL_ANSWERS: Record<SupportQuestionKey, Record<'pt-BR' | 'en-US', string>> = {
  manage_subscription: {
    'pt-BR': 'Sua assinatura reúne plano, provider, estado atual e próxima renovação. Posso explicar agora como o pagamento e a recorrência funcionam.',
    'en-US': 'Your subscription includes your plan, provider, current status, and next renewal. I can now explain how payment and recurrence work.',
  },
  payment_and_recurrence: {
    'pt-BR': 'A recorrência segue o provider da compra. Stripe gerencia cartões e carteiras; Asaas gera cobranças Pix por ciclo; Apple e Google seguem as regras da loja. Posso explicar o processo de cancelamento se você ainda quiser seguir.',
    'en-US': 'Recurrence follows the purchase provider. Stripe manages cards and wallets; Asaas creates a Pix charge each cycle; Apple and Google follow store rules. I can explain the cancellation process if you still want to continue.',
  },
  cancel_subscription: {
    'pt-BR': 'O cancelamento começa com uma solicitação detalhada para análise humana. Enviar a solicitação não interrompe a cobrança imediatamente; um manager registra a decisão e a execução no provider. O formulário está disponível abaixo.',
    'en-US': 'Cancellation starts with a detailed request for human review. Submitting it does not immediately stop billing; a manager records the decision and provider execution. The form is now available below.',
  },
};

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function findSupportKnowledge(query: string, limit = 3): SupportKnowledgeSection[] {
  const normalized = normalize(query);
  return SUPPORT_KNOWLEDGE_BASE
    .map(section => ({ section, score: section.keywords.reduce((score, keyword) => score + (normalized.includes(normalize(keyword)) ? 2 : 0), normalized.includes(normalize(section.title)) ? 3 : 0) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.section);
}

export function answerSupportQuestionKey(key: SupportQuestionKey, locale: 'pt-BR' | 'en-US'): string {
  return FUNNEL_ANSWERS[key][locale];
}

export function answerSupportQuestion(
  query: string,
  billing?: { plan: string; provider: string | null; state: string },
  locale: 'pt-BR' | 'en-US' = 'pt-BR',
): string {
  const sections = findSupportKnowledge(query);
  const english = locale === 'en-US';
  const answer = sections.length > 0
    ? sections.map(section => english ? ENGLISH_SUPPORT_COPY[section.key] || section.body : section.body).join('\n\n')
    : english
      ? 'I could not find a safe answer in the support knowledge base. I can preserve the context for human review.'
      : 'Não encontrei uma resposta segura na base de suporte. Posso registrar o contexto para revisão humana.';
  if (!billing) return answer;
  const providerNames: Record<string, string> = { stripe: 'Stripe', asaas: 'Asaas', apple: 'App Store', google: 'Google Play' };
  const provider = billing.provider ? providerNames[billing.provider] || billing.provider : null;
  if (english) return `${answer}\n\nYour account is on ${billing.plan.toUpperCase()}${provider ? `, managed by ${provider}` : ''}, with status ${billing.state}.`;
  return `${answer}\n\nSua conta está no plano ${billing.plan.toUpperCase()}${provider ? `, gerenciado por ${provider}` : ''}, com estado ${billing.state}.`;
}

export function localizedSupportSource(section: SupportKnowledgeSection, locale: 'pt-BR' | 'en-US') {
  return { key: section.key, title: locale === 'en-US' ? ENGLISH_SUPPORT_TITLES[section.key] || section.title : section.title };
}
