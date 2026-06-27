export type ParsedChecklist = {
  name: string;
  items: string[];
};

const FILLER_PREFIXES = [
  'crie uma checklist',
  'criar uma checklist',
  'crie um checklist',
  'criar um checklist',
  'checklist',
  'lista',
  'comprar',
  'compra de',
  'compras de',
  'compras do',
];

function cleanItem(value: string): string {
  return value
    .replace(/^[\s\-*•\d.)]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCaseFallback(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'Nova checklist';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function inferName(text: string, items: string[]): string {
  const normalized = text.toLowerCase();
  const named = normalized.match(/\b(?:chamada|chamado|nome|named|called)\s+["“]?([^",.;\n]+)["”]?/);
  if (named?.[1]) return titleCaseFallback(named[1]);
  const purchase = normalized.match(/\b(?:mercado|supermercado|roupa|roupas|farmacia|farmácia|viagem|casa)\b/);
  if (purchase?.[0]) {
    const label = purchase[0] === 'supermercado' ? 'mercado' : purchase[0];
    return `Compra de ${titleCaseFallback(label)}`;
  }
  if (items.length > 0) return 'Checklist';
  return titleCaseFallback(text.slice(0, 80));
}

export function parseChecklistText(input: string): ParsedChecklist {
  const text = input.replace(/\r/g, '\n').trim();
  if (!text) return { name: 'Nova checklist', items: [] };

  const afterColon = text.includes(':') ? text.slice(text.indexOf(':') + 1) : text;
  const rawCandidates = afterColon
    .split(/\n|,|;|\se\s(?=\S)/i)
    .map(cleanItem)
    .filter(Boolean);

  const items = rawCandidates
    .map((item) => {
      const lower = item.toLowerCase();
      const prefix = FILLER_PREFIXES.find((candidate) => lower.startsWith(candidate));
      return prefix ? cleanItem(item.slice(prefix.length)) : item;
    })
    .filter((item) => !['mercado', 'supermercado', 'roupa', 'roupas'].includes(item.toLowerCase()))
    .filter((item) => item.length >= 2)
    .slice(0, 80);

  return {
    name: inferName(text, items),
    items,
  };
}
