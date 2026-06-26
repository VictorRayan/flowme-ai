import { inferRecentConnectorType } from '@/lib/ai/connector-context';

export type ConnectorAction =
  | 'gmail'
  | 'drive'
  | 'docs'
  | 'sheets'
  | 'briefing'
  | 'note'
  | 'weather'
  | 'council'
  | 'slack'
  | 'reminder'
  | 'image';

export type ConnectorIntent = {
  id?: string;
  label?: string;
  action?: ConnectorAction;
};

type IntentMessage = {
  role?: string;
  content?: string;
  selectedAction?: ConnectorIntent | ConnectorAction | string | null;
  thinking?: Array<{ tool?: string; status?: string; receipt?: any }>;
};

const ACTION_LABELS: Record<ConnectorAction, string> = {
  gmail: '/gmail',
  drive: '/drive',
  docs: '/docs',
  sheets: '/sheets',
  briefing: '/briefing',
  note: '/note',
  weather: '/weather',
  council: '/council',
  slack: '/slack',
  reminder: '/reminder',
  image: '/image',
};

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function toIntent(action: ConnectorAction, idPrefix = 'implicit'): ConnectorIntent {
  return { id: `${idPrefix}-${action}`, label: ACTION_LABELS[action], action };
}

function parseSelectedAction(value: unknown): ConnectorAction | null {
  if (!value) return null;
  if (typeof value === 'object' && value && 'action' in value) {
    return parseSelectedAction((value as { action?: unknown }).action);
  }
  if (typeof value !== 'string') return null;
  const normalized = normalize(value).replace(/^\//, '');
  if (normalized === 'planilhas' || normalized === 'sheets') return 'sheets';
  if (normalized === 'docs' || normalized === 'documentos') return 'docs';
  if (normalized === 'gmail' || normalized === 'email' || normalized === 'emails') return 'gmail';
  if (normalized === 'drive') return 'drive';
  if (normalized === 'weather' || normalized === 'clima' || normalized === 'tempo') return 'weather';
  if (normalized === 'image' || normalized === 'imagem') return 'image';
  if (normalized === 'reminder' || normalized === 'lembrete') return 'reminder';
  if (normalized === 'briefing') return 'briefing';
  return null;
}

function recentSelectedAction(messages: IntentMessage[] = []): ConnectorAction | null {
  for (let index = messages.length - 1; index >= Math.max(0, messages.length - 10); index -= 1) {
    const action = parseSelectedAction(messages[index]?.selectedAction);
    if (action) return action;
  }
  return null;
}

function recentConnectorAction(messages: IntentMessage[] = []): ConnectorAction | null {
  const selected = recentSelectedAction(messages);
  if (selected) return selected;
  const recentType = inferRecentConnectorType(messages);
  if (recentType === 'gmail') return 'gmail';
  if (recentType === 'google_docs') return 'docs';
  if (recentType === 'google_sheets') return 'sheets';
  if (recentType === 'google_drive') return 'drive';
  return null;
}

function isFollowUpLike(normalized: string): boolean {
  return /\b(yes|sim|ok|okay|isso|esse|essa|este|esta|aquele|aquela|ele|ela|it|that|this|the first|the second|o primeiro|a primeira|sobre isso|about that|nesse|neste|nessa|nesta)\b/.test(normalized)
    || /\b(reply|respond|answer|write back|draft|send an email|responda|responder|resposta|rascunho|retorne|retornar|diga para|avise|mande|envie)\b/.test(normalized);
}

function hasExplicitConnectorDomain(normalized: string): boolean {
  return /\b(gmail|e-mail|email|emails|drive|google docs|docs|documentos|sheets|spreadsheet|spreadsheets|planilha|planilhas|slack)\b/.test(normalized);
}

function explicitIntentFromText(normalized: string): ConnectorIntent | null {
  if (/\b(gmail|email|emails|e-mail|inbox|caixa de entrada|rascunho|draft|reply|respond|answer|write back|responda|responder|resposta|follow-up|send an email|mande um email|envie um email)\b/.test(normalized)) {
    return toIntent('gmail');
  }
  if (/\b(planilha|planilhas|spreadsheet|spreadsheets|sheets|sheet|finance 2026|despesa|gasto|gastos|receita|categoria|formula|celula|aba)\b/.test(normalized)) {
    return toIntent('sheets');
  }
  if (/\b(google docs|documento|documentos|docs|ata|memo|briefing executivo|relatorio|proposta|escrivao|editar documento)\b/.test(normalized)) {
    return toIntent('docs');
  }
  if (/\b(drive|arquivo|arquivos|pasta|pdf|slides|contrato)\b/.test(normalized)) {
    return toIntent('drive');
  }
  if (/\b(clima|tempo|weather|forecast|previsao)\b/.test(normalized)) {
    return toIntent('weather');
  }
  if (/\b(imagem|image|generate image|gerar imagem|crie uma imagem)\b/.test(normalized)) {
    return toIntent('image');
  }
  if (/\b(lembrete|reminder|lembrar|remind me)\b/.test(normalized)) {
    return toIntent('reminder');
  }
  if (/\b(priorizar|prioridade|prioridades|focus|foco|semana|hoje|direcionamento|o que devo fazer)\b/.test(normalized)) {
    return toIntent('briefing');
  }
  return null;
}

export function inferImplicitConnectorIntent(text: string, messages: IntentMessage[] = []): ConnectorIntent | null {
  const normalized = normalize(text);
  const recentAction = recentConnectorAction(messages);
  if (recentAction && isFollowUpLike(normalized) && !hasExplicitConnectorDomain(normalized)) {
    return toIntent(recentAction, 'thread-followup');
  }

  const explicit = explicitIntentFromText(normalized);
  if (explicit) return explicit;

  if (recentAction && isFollowUpLike(normalized)) {
    return toIntent(recentAction, 'thread-followup');
  }

  return null;
}
