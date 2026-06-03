import { normalizeFinanceCurrency } from './currency';
import type { FinanceCurrency, FinanceTransactionType } from './types';

export interface ParsedFinancialTransaction {
  type: FinanceTransactionType;
  amount: number | null;
  currency: FinanceCurrency;
  occurred_on: string;
  category_name: string;
  merchant: string | null;
  description: string;
  confidence: number;
  needs_review: boolean;
}

function localDate(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date: string, amount: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
}

function parseAmount(text: string): number | null {
  const match = text.match(/(?:R\$\s*|\$\s*|€\s*|£\s*)?(\d+(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i);
  if (!match) return null;
  const raw = match[1].replace(/\s/g, '');
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : /\.\d{3}$/.test(raw) ? raw.replace(/\./g, '') : raw;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

function inferCurrency(text: string, fallback: FinanceCurrency): FinanceCurrency {
  if (/\b(reais|real|brl)\b|R\$/i.test(text)) return 'BRL';
  if (/\b(d[oó]lares?|usd)\b|\$/i.test(text)) return 'USD';
  if (/\b(euros?|eur)\b|€/i.test(text)) return 'EUR';
  if (/\b(libras?|gbp)\b|£/i.test(text)) return 'GBP';
  if (/\b(pesos?\s+argentinos?|ars)\b/i.test(text)) return 'ARS';
  if (/\b(pesos?\s+mexicanos?|mxn)\b/i.test(text)) return 'MXN';
  return fallback;
}

function inferType(text: string): FinanceTransactionType {
  if (/\b(recebi|receita|sal[aá]rio|pagamento recebido|caiu|entrada|freela|freelance)\b/i.test(text)) return 'income';
  if (/\b(investi|investimento|apliquei|tesouro|cdb|ações|acoes|previd[eê]ncia|cripto)\b/i.test(text)) return 'investment';
  if (/\b(transferi|transfer[eê]ncia)\b/i.test(text)) return 'transfer';
  return 'expense';
}

function inferDate(text: string, now: Date, timezone: string): string {
  const today = localDate(now, timezone);
  if (/\b(ontem|yesterday)\b/i.test(text)) return addDays(today, -1);
  if (/\b(anteontem)\b/i.test(text)) return addDays(today, -2);
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slash) {
    const day = slash[1].padStart(2, '0');
    const month = slash[2].padStart(2, '0');
    const year = slash[3] ? slash[3].padStart(4, '20') : today.slice(0, 4);
    return `${year}-${month}-${day}`;
  }
  return today;
}

const CATEGORY_RULES: Array<{ category: string; merchant?: string; pattern: RegExp }> = [
  { category: 'alimentação', pattern: /\b(almo[cç]o|jantar|caf[eé]|restaurante|ifood|delivery|lanche|padaria)\b/i },
  { category: 'mercado', pattern: /\b(mercado|supermercado|hortifruti|a[cç]ougue|farmers market)\b/i },
  { category: 'transporte', merchant: 'Uber', pattern: /\b(uber|99|taxi|t[aá]xi|combust[ií]vel|gasolina|metr[oô]|ônibus|onibus)\b/i },
  { category: 'moradia', pattern: /\b(aluguel|condom[ií]nio|luz|energia|internet|água|agua|g[aá]s)\b/i },
  { category: 'saúde', pattern: /\b(m[eé]dico|consulta|farm[aá]cia|rem[eé]dio|exame|dentista|sa[uú]de)\b/i },
  { category: 'educação', pattern: /\b(curso|livro|faculdade|escola|educa[cç][aã]o)\b/i },
  { category: 'lazer', pattern: /\b(cinema|bar|show|jogo|lazer|viagem)\b/i },
  { category: 'assinaturas', pattern: /\b(netflix|spotify|assinatura|icloud|notion|openai|chatgpt)\b/i },
  { category: 'impostos', pattern: /\b(imposto|darf|ipva|iptu|irpf|taxa)\b/i },
  { category: 'dívidas', pattern: /\b(d[ií]vida|empr[eé]stimo|financiamento|cart[aã]o)\b/i },
  { category: 'salário', pattern: /\b(sal[aá]rio|holerite)\b/i },
  { category: 'freelance', pattern: /\b(freela|freelance|cliente)\b/i },
  { category: 'renda fixa', pattern: /\b(tesouro|cdb|lci|lca|renda fixa)\b/i },
];

function inferCategory(text: string, type: FinanceTransactionType): { category: string; merchant: string | null; confidence: number } {
  const rule = CATEGORY_RULES.find(item => item.pattern.test(text));
  if (rule) return { category: rule.category, merchant: rule.merchant || null, confidence: 0.92 };
  if (type === 'income') return { category: 'outros', merchant: null, confidence: 0.72 };
  if (type === 'investment') return { category: 'outros', merchant: null, confidence: 0.76 };
  return { category: 'outros', merchant: null, confidence: 0.62 };
}

export function parseFinancialTransaction(
  text: string,
  options: { defaultCurrency?: FinanceCurrency; now?: Date; timezone?: string } = {},
): ParsedFinancialTransaction {
  const cleaned = text.trim();
  const now = options.now || new Date();
  const timezone = options.timezone || 'UTC';
  const fallbackCurrency = normalizeFinanceCurrency(options.defaultCurrency || 'BRL');
  const type = inferType(cleaned);
  const amount = parseAmount(cleaned);
  const currency = inferCurrency(cleaned, fallbackCurrency);
  const occurredOn = inferDate(cleaned, now, timezone);
  const category = inferCategory(cleaned, type);
  const confidence = Math.min(category.confidence, amount ? 0.95 : 0.35);

  return {
    type,
    amount,
    currency,
    occurred_on: occurredOn,
    category_name: category.category,
    merchant: category.merchant,
    description: cleaned,
    confidence,
    needs_review: !amount || confidence < 0.75,
  };
}
