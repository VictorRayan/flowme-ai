export const SUPPORT_REQUEST_CATEGORIES = [
  'payment',
  'account_access',
  'bug',
  'connectors',
  'ai',
  'feature_request',
  'other',
] as const;

export type SupportRequestCategory = typeof SUPPORT_REQUEST_CATEGORIES[number];

export const ACTIVE_SUPPORT_REQUEST_STATUSES = ['open', 'in_review', 'needs_info'] as const;

export function isSupportRequestCategory(value: unknown): value is SupportRequestCategory {
  return typeof value === 'string' && SUPPORT_REQUEST_CATEGORIES.includes(value as SupportRequestCategory);
}

export function normalizeSupportRequestText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function inferSupportRequestCategory(message: string): SupportRequestCategory {
  const text = normalized(message);
  if (/\b(pagamento|cobranca|cartao|pix|fatura|checkout|payment|billing|charge|invoice|card)\b/.test(text)) return 'payment';
  if (/\b(login|acesso|entrar|senha|account|sign in|auth|session)\b/.test(text)) return 'account_access';
  if (/\b(conector|conectores|gmail|drive|docs|sheets|slack|whatsapp|oauth|integracao|integration)\b/.test(text)) return 'connectors';
  if (/\b(ia|ai|balys|modelo|prompt|resposta|credits|creditos|cr[ée]ditos)\b/.test(text)) return 'ai';
  if (/\b(erro|falha|bug|travou|quebrou|nao funciona|issue|problem|broken|crash)\b/.test(text)) return 'bug';
  if (/\b(sugest|feature|melhoria|improvement|request|pedido)\b/.test(text)) return 'feature_request';
  return 'other';
}
