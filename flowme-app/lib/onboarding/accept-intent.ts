// Detects when a typed reply means "accept the pending proposal" so the user
// can confirm by message instead of clicking the accept button.
// Kept intentionally tight: only short, unambiguous confirmations count, so a
// sentence that merely mentions "aceitar" in passing does not auto-advance.

const ACCEPT_PATTERNS: RegExp[] = [
  /\baceit(ar|o|a|e)\b/,
  /\bconfirm(ar|o|a|e)\b/,
  /\bconcord(o|a)\b/,
  /\bfechad[oa]\b/,
  /\bpode (aceitar|seguir|fechar|prosseguir)\b/,
  /\b(vamos|bora) (aceitar|seguir|fechar|comecar|nessa)\b/,
  /\baccept(ed)?\b/,
  /\bconfirm\b/,
  /\blet'?s (go|start|do it)\b/,
];

const NEGATION = /\b(nao|don'?t|do not|nunca|jamais)\b/;

export function isAcceptProposalIntent(text: string): boolean {
  if (!text) return false;
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
  if (!normalized) return false;
  if (NEGATION.test(normalized)) return false;
  if (normalized.split(/\s+/).length > 6) return false;
  return ACCEPT_PATTERNS.some((re) => re.test(normalized));
}
