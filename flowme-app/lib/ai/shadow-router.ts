type Provider = 'openai' | 'gemini';
type TaskType = 'calendar' | 'notes' | 'goals' | 'briefing' | 'mixed' | 'council' | 'email';
type WriteIntent = 'none' | 'read_only' | 'write_notes' | 'write_calendar' | 'write_both' | 'write_email';
type Tier = 'cheap' | 'mid' | 'strong';
type ExecutionPlan = 'direct_tool' | 'plan_then_tool' | 'retrieve_then_plan_then_tool' | 'briefing_pipeline' | 'council_pipeline';
type ServiceTier = 'standard' | 'flex' | 'batch' | 'priority';
type ToolDomain = 'calendar' | 'gmail' | 'connectors' | 'notes' | 'all' | 'none';

export interface RouterMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Array<{ type: 'image' | 'file' | 'audio' }>;
}

export interface ModelTarget {
  provider: Provider;
  model: string;
}

export interface ShadowRouterDecision {
  taskType: TaskType;
  needsTools: boolean;
  writeIntent: WriteIntent;
  toolDomain: ToolDomain;
  scores: {
    ambiguity: number;
    reasoning: number;
    workflowLength: number;
    risk: number;
  };
  overallScore: number;
  tier: Tier;
  executionPlan: ExecutionPlan;
  serviceTier: ServiceTier;
  planner: ModelTarget;
  executor: ModelTarget;
  verifier: ModelTarget;
  primary: ModelTarget;
  fallbacks: Array<{ when: string; target: ModelTarget }>;
  shadow: ModelTarget | null;
  gates: {
    alwaysVerifyOnWrite: boolean;
    confirmBeforeWrite: boolean;
    confirmBeforeDelete: boolean;
    askBeforeExecute: boolean;
    maxAutoToolCalls: number;
  };
  telemetryTags: Record<string, string>;
  userFacingLabel: string;
}

export interface ContextScoreOverride {
  ambiguity?: number;
  reasoning?: number;
  workflowLength?: number;
  risk?: number;
  threadDepth?: number;  // boosts reasoning score when thread is deep
  topicShift?: number;   // reduces ambiguity score when topic just shifted (fresh frame)
  confidence?: number;   // how much weight to give these overrides (0–1)
}

interface RouteInput {
  messages: RouterMessage[];
  rawUserInput?: string;
  systemAddendum?: string;
  contextScores?: ContextScoreOverride;  // from context-scorer, injected by chat route
}

const GEMINI_CHEAP: ModelTarget = { provider: 'gemini', model: 'gemini-2.5-flash' };
const GEMINI_MID: ModelTarget = { provider: 'gemini', model: 'gemini-2.5-flash' };
const GEMINI_STRONG: ModelTarget = { provider: 'gemini', model: 'gemini-2.5-pro' };
const OPENAI_CHEAP: ModelTarget = { provider: 'openai', model: 'gpt-5.4-nano' };
const OPENAI_MID: ModelTarget = { provider: 'openai', model: 'gpt-5.4-mini' };
const OPENAI_STRONG: ModelTarget = { provider: 'openai', model: 'gpt-5.4' };

const ROUTER_VERSION = 'shadow-antigravity-2026-04-12';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function uniqueTargets(targets: ModelTarget[]): ModelTarget[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = `${target.provider}:${target.model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasProviderKey(provider: Provider): boolean {
  return provider === 'gemini' ? Boolean(process.env.GEMINI_API_KEY) : Boolean(process.env.OPENAI_API_KEY);
}

function isAvailable(target: ModelTarget): boolean {
  return hasProviderKey(target.provider);
}

function resolvePreferred(primary: ModelTarget, alternate: ModelTarget): ModelTarget {
  if (isAvailable(primary)) return primary;
  if (isAvailable(alternate)) return alternate;
  return primary;
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function extractLatestUserMessage(messages: RouterMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user' && messages[i].content) return messages[i].content;
  }
  return '';
}

function inferTaskType(text: string): TaskType {
  const isCalendar = hasAny(text, [
    /\b(calendar|event|events|meeting|schedule)\b/,
    /\b(calendario|agenda|evento|eventos|reuniao|reuni[aã]o|agendar|marcar)\b/,
  ]);
  const isNotes = hasAny(text, [
    /\b(note|notes|notebook|journal)\b/,
    /\b(nota|notas|caderno|anotacao|anotacoes|anota[cç][aã]o|anota[cç][oõ]es)\b/,
  ]);
  const isGoals = hasAny(text, [
    /\b(goal|goals|plan|roadmap|milestone)\b/,
    /\b(meta|metas|objetivo|objetivos|plano|roteiro)\b/,
  ]);
  const isBriefing = hasAny(text, [
    /\b(briefing|daily brief|summary of my day|top 3)\b/,
    /\b(resumo do dia|briefing diario|briefing di[aá]rio|top 3)\b/,
  ]);
  const isCouncil = hasAny(text, [
    /\b(council|mastermind|board|advisors)\b/,
    /\b(conselho|mastermind|conselheiros|council)\b/,
  ]);
  const isEmail = hasAny(text, [
    /\b(email|emails|gmail|inbox|send)\b/,
    /\b(email|emails|gmail|caixa de entrada|enviar email)\b/,
  ]);

  const matches = [isCalendar, isNotes, isGoals, isBriefing, isCouncil, isEmail].filter(Boolean).length;
  if (matches > 1 && !isCouncil) return 'mixed';
  if (isCouncil) return 'council';
  if (isCalendar) return 'calendar';
  if (isEmail) return 'email';
  if (isNotes) return 'notes';
  if (isGoals) return 'goals';
  if (isBriefing) return 'briefing';
  return 'mixed';
}

function inferWriteIntent(text: string, taskType: TaskType): WriteIntent {
  const readOnly = hasAny(text, [
    /\b(show|list|find|search|read|summari[sz]e|explain|what do i have)\b/,
    /\b(mostrar|listar|buscar|ler|resumir|explicar|o que eu tenho)\b/,
  ]);
  const write = hasAny(text, [
    /\b(create|add|append|write|update|edit|delete|remove|cancel|move|reschedule|schedule|book)\b/,
    /\b(criar|adicionar|anexar|escrever|atualizar|editar|deletar|apagar|excluir|remover|cancelar|mover|reagendar|agendar|marcar)\b/,
  ]);

  if (!write) return readOnly ? 'read_only' : 'none';

  if (taskType === 'calendar') return 'write_calendar';
  if (taskType === 'notes') return 'write_notes';
  if (taskType === 'email') return 'write_email';
  if (taskType === 'mixed') return 'write_both';
  if (taskType === 'briefing') return readOnly ? 'read_only' : 'write_both';
  if (taskType === 'goals') return 'write_notes';
  if (taskType === 'council') return 'read_only';
  return 'none';
}

function inferToolDomain(taskType: TaskType, text: string): ToolDomain {
  if (taskType === 'calendar') return 'calendar';
  if (taskType === 'email') return 'gmail';
  if (taskType === 'notes') return 'notes';
  if (taskType === 'mixed' || taskType === 'briefing') return 'all';
  if (hasAny(text, [/\b(connector|connectors|integrations|accounts)\b/, /\b(conector|conectores|integra[cç][oõ]es|contas)\b/])) return 'connectors';
  return 'none';
}

function inferNeedsTools(taskType: TaskType, text: string): boolean {
  if (taskType === 'briefing') return true;
  if (taskType === 'calendar' || taskType === 'notes' || taskType === 'goals') return true;
  if (taskType === 'email' || taskType === 'mixed') return true;
  return hasAny(text, [
    /\b(calendar|note|notes|goal|goals)\b/,
    /\b(calendario|agenda|nota|notas|meta|metas)\b/,
  ]);
}

function scoreAmbiguity(text: string, taskType: TaskType, writeIntent: WriteIntent): number {
  const relativeTerms = countMatches(text, [
    /\b(today|tomorrow|tonight|later|soon|next|this|after lunch|in the morning)\b/,
    /\b(hoje|amanha|amanh[aã]|mais tarde|depois|logo|proxima|pr[óo]xima|esta|esse|essa|de manha|de manh[aã]|depois do almoco|depois do almo[cç]o)\b/,
  ]);
  const vagueRefs = countMatches(text, [
    /\b(this one|that one|it|them|something like that)\b/,
    /\b(isso|aquilo|esse|essa|esse evento|essa nota|algo assim)\b/,
  ]);

  let score = 0.05 + relativeTerms * 0.18 + vagueRefs * 0.16;

  if (taskType === 'calendar' && writeIntent !== 'none') {
    const hasTime = /\b\d{1,2}(:\d{2})?\b/.test(text);
    const hasDateWord = hasAny(text, [
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
      /\b(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)\b/,
    ]);
    if (!hasTime) score += 0.18;
    if (!hasDateWord && !/\d{4}-\d{2}-\d{2}/.test(text)) score += 0.14;
  }

  if (taskType === 'notes' && writeIntent === 'write_notes' && !hasAny(text, [/\bnote\b/, /\bnota\b/])) {
    score += 0.12;
  }

  return clamp01(score);
}

function scoreReasoning(text: string, taskType: TaskType, messageCount: number): number {
  const complexTerms = countMatches(text, [
    /\b(compare|prioriti[sz]e|reorgani[sz]e|replan|decide|analy[sz]e|synthesize|extract|consolidate|strategy|trade[- ]off)\b/,
    /\b(comparar|priorizar|reorganizar|replanejar|decidir|analisar|sintetizar|extrair|consolidar|estrategia|estrat[eé]gia)\b/,
  ]);
  const sequentialTerms = countMatches(text, [
    /\b(and then|then|after that|also|while|based on)\b/,
    /\b(e depois|depois|tambem|tamb[eé]m|enquanto|com base)\b/,
  ]);

  let score = 0.05 + complexTerms * 0.16 + sequentialTerms * 0.08;

  if (taskType === 'goals' || taskType === 'briefing') score += 0.18;
  if (taskType === 'council') score += 0.30;
  if (taskType === 'mixed') score += 0.14;
  if (text.length > 500) score += 0.12;
  if (messageCount > 8) score += 0.08;

  return clamp01(score);
}

function scoreWorkflowLength(text: string, needsTools: boolean, attachmentCount: number): number {
  const actionCount = countMatches(text, [
    /\b(create|add|update|edit|delete|remove|cancel|move|reschedule|list|summari[sz]e|extract)\b/,
    /\b(criar|adicionar|atualizar|editar|deletar|apagar|excluir|remover|cancelar|mover|reagendar|listar|resumir|extrair)\b/,
  ]);
  const clauseCount = countMatches(text, [
    /,/,
    /\band\b/,
    /\be\b/,
    /\bthen\b/,
    /\bdepois\b/,
  ]);

  let score = 0.05 + Math.min(0.36, actionCount * 0.09) + Math.min(0.18, clauseCount * 0.03);
  if (needsTools) score += 0.12;
  if (attachmentCount > 0) score += Math.min(0.18, attachmentCount * 0.06);
  if (text.length > 800) score += 0.1;

  return clamp01(score);
}

function scoreRisk(text: string, taskType: TaskType, writeIntent: WriteIntent): number {
  const deleteTerms = countMatches(text, [
    /\b(delete|remove|cancel|wipe|erase)\b/,
    /\b(deletar|apagar|excluir|remover|cancelar|limpar)\b/,
  ]);
  const highImpactTerms = countMatches(text, [
    /\b(replan|reorgani[sz]e|move all|entire week|everyone|participants)\b/,
    /\b(replanejar|reorganizar|mover tudo|semana inteira|todos|participantes)\b/,
  ]);

  let score = 0.04 + deleteTerms * 0.34 + highImpactTerms * 0.18;

  if (taskType === 'calendar' && writeIntent === 'write_calendar') score += 0.18;
  if (taskType === 'mixed' && writeIntent === 'write_both') score += 0.22;
  if (taskType === 'goals') score += 0.1;
  if (hasAny(text, [/\b(all|every|entire|bulk)\b/, /\b(tudo|todos|inteiro|em massa)\b/])) score += 0.18;

  return clamp01(score);
}

function scoreOverall(scores: ShadowRouterDecision['scores']): number {
  return clamp01(
    (scores.ambiguity * 0.35) +
    (scores.reasoning * 0.35) +
    (scores.workflowLength * 0.2) +
    (scores.risk * 0.1)
  );
}

function pickTier(score: number): Tier {
  if (score < 0.25) return 'cheap';
  if (score < 0.55) return 'mid';
  return 'strong';
}

function pickExecutionPlan(taskType: TaskType, tier: Tier, needsTools: boolean, writeIntent: WriteIntent): ExecutionPlan {
  if (taskType === 'council') return 'council_pipeline';
  if (taskType === 'briefing') return 'briefing_pipeline';
  if (taskType === 'notes' && (tier === 'mid' || tier === 'strong')) return 'retrieve_then_plan_then_tool';
  if (needsTools && (tier !== 'cheap' || writeIntent !== 'read_only')) return 'plan_then_tool';
  return 'direct_tool';
}

function chooseModels(
  tier: Tier,
  scores: ShadowRouterDecision['scores'],
  needsTools: boolean
): Pick<ShadowRouterDecision, 'planner' | 'executor' | 'verifier' | 'primary' | 'shadow'> {
  const cheapBase = {
    planner: resolvePreferred(GEMINI_CHEAP, OPENAI_CHEAP),
    executor: resolvePreferred(GEMINI_CHEAP, OPENAI_CHEAP),
    verifier: resolvePreferred(GEMINI_CHEAP, OPENAI_CHEAP),
  };
  const midBase = {
    planner: resolvePreferred(GEMINI_MID, OPENAI_MID),
    executor: resolvePreferred(GEMINI_CHEAP, OPENAI_CHEAP),
    verifier: resolvePreferred(GEMINI_MID, OPENAI_MID),
  };
  const strongBase = {
    planner: resolvePreferred(GEMINI_STRONG, OPENAI_STRONG),
    executor: resolvePreferred(GEMINI_MID, OPENAI_MID),
    verifier: resolvePreferred(GEMINI_STRONG, OPENAI_STRONG),
  };

  const base = tier === 'cheap' ? cheapBase : tier === 'mid' ? midBase : strongBase;
  const planner = { ...base.planner };
  const executor = { ...base.executor };
  const verifier = { ...base.verifier };

  if (scores.risk >= 0.6 && isAvailable(OPENAI_STRONG)) {
    verifier.provider = OPENAI_STRONG.provider;
    verifier.model = OPENAI_STRONG.model;
  }

  if (needsTools && scores.workflowLength >= 0.7 && isAvailable(OPENAI_STRONG)) {
    planner.provider = OPENAI_STRONG.provider;
    planner.model = OPENAI_STRONG.model;
  }

  const primary = tier === 'cheap' ? executor : planner;
  const shadow = primary.provider === 'gemini'
    ? (isAvailable(OPENAI_MID) ? OPENAI_MID : null)
    : (isAvailable(GEMINI_MID) ? GEMINI_MID : null);

  return { planner, executor, verifier, primary, shadow };
}

function buildFallbacks(primary: ModelTarget, tier: Tier): Array<{ when: string; target: ModelTarget }> {
  const sameTierFallback = tier === 'cheap'
    ? resolvePreferred(OPENAI_CHEAP, GEMINI_CHEAP)
    : tier === 'mid'
      ? resolvePreferred(OPENAI_MID, GEMINI_MID)
      : resolvePreferred(OPENAI_STRONG, GEMINI_STRONG);

  const promotedFallback = tier === 'cheap'
    ? resolvePreferred(GEMINI_MID, OPENAI_MID)
    : resolvePreferred(GEMINI_STRONG, OPENAI_STRONG);

  const finalFallback = tier === 'strong'
    ? resolvePreferred(OPENAI_STRONG, GEMINI_STRONG)
    : resolvePreferred(OPENAI_STRONG, GEMINI_STRONG);

  return uniqueTargets([sameTierFallback, promotedFallback, finalFallback])
    .filter((target) => `${target.provider}:${target.model}` !== `${primary.provider}:${primary.model}`)
    .map((target, index) => ({
      when: index === 0 ? 'provider_or_schema_error' : index === 1 ? 'verifier_rejects_or_high_risk' : 'final_rescue',
      target,
    }));
}

function buildUserFacingLabel(tier: Tier, primary: ModelTarget): string {
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  return `Shadow Router - ${tierLabel} - ${primary.provider === 'gemini' ? 'Gemini' : 'OpenAI'}`;
}

export function routeBalysRequest(input: RouteInput): ShadowRouterDecision {
  const latestUser = normalizeText(input.rawUserInput || extractLatestUserMessage(input.messages));
  const attachmentCount = input.messages.reduce((total, message) => total + (message.attachments?.length || 0), 0);
  const taskType = inferTaskType(latestUser);
  const writeIntent = inferWriteIntent(latestUser, taskType);
  const needsTools = inferNeedsTools(taskType, latestUser);
  const toolDomain = inferToolDomain(taskType, latestUser);

  const staticScores = {
    ambiguity:      scoreAmbiguity(latestUser, taskType, writeIntent),
    reasoning:      scoreReasoning(latestUser, taskType, input.messages.length),
    workflowLength: scoreWorkflowLength(latestUser, needsTools, attachmentCount),
    risk:           scoreRisk(latestUser, taskType, writeIntent),
  };

  // Blend in context scorer signal when available.
  // confidence controls how much the LLM-derived scores pull the static ones.
  const ctx = input.contextScores;
  const w = ctx?.confidence ?? 0; // blend weight: 0 = ignore, 1 = fully trust LLM scorer
  const blend = (stat: number, override: number | undefined) =>
    override !== undefined ? clamp01(stat * (1 - w) + override * w) : stat;

  const scores = {
    ambiguity:      blend(staticScores.ambiguity,      ctx?.ambiguity),
    reasoning:      blend(staticScores.reasoning,      ctx?.reasoning) +
                    // deep thread context boosts reasoning requirement
                    (ctx?.threadDepth !== undefined ? clamp01(ctx.threadDepth * 0.15 * w) : 0),
    workflowLength: blend(staticScores.workflowLength, ctx?.workflowLength),
    risk:           blend(staticScores.risk,           ctx?.risk),
  };
  // Re-clamp after additions
  scores.reasoning = clamp01(scores.reasoning);
  const overallScore = scoreOverall(scores);
  const tier = pickTier(overallScore);
  const executionPlan = pickExecutionPlan(taskType, tier, needsTools, writeIntent);
  const { planner, executor, verifier, primary, shadow } = chooseModels(tier, scores, needsTools);
  const fallbacks = buildFallbacks(primary, tier);
  const isWrite = writeIntent === 'write_calendar' || writeIntent === 'write_notes' || writeIntent === 'write_both';
  const confirmBeforeDelete = hasAny(latestUser, [
    /\b(delete|remove|cancel)\b/,
    /\b(deletar|apagar|excluir|remover|cancelar)\b/,
  ]);

  return {
    taskType,
    needsTools,
    writeIntent,
    toolDomain,
    scores,
    overallScore,
    tier,
    executionPlan,
    serviceTier: executionPlan === 'briefing_pipeline' ? 'flex' : 'standard',
    planner,
    executor,
    verifier,
    primary,
    fallbacks,
    shadow,
    gates: {
      alwaysVerifyOnWrite: isWrite,
      confirmBeforeWrite: isWrite && scores.risk >= 0.6,
      confirmBeforeDelete,
      askBeforeExecute: scores.ambiguity >= 0.6 && isWrite,
      maxAutoToolCalls: tier === 'cheap' ? 3 : tier === 'mid' ? 6 : 12,
    },
    telemetryTags: {
      router_version: ROUTER_VERSION,
      task_type: taskType,
      tier,
      write_intent: writeIntent,
      execution_plan: executionPlan,
      service_tier: executionPlan === 'briefing_pipeline' ? 'flex' : 'standard',
    },
    userFacingLabel: buildUserFacingLabel(tier, primary),
  };
}
