import OpenAI from 'openai';

// ==========================================
// Council Members Details & System Prompts
// ==========================================

export const councilMembers = [
  {
    role: 'advogado',
    title: 'Advogado (Law & Protection)',
    prompt: `Act as a senior, extremely sharp corporate and civil lawyer. Your goal is to identify liabilities, legal risks, structural vulnerabilities, and compliance issues in the user's situation. Be direct, pragmatic, and protective. Point out contracts needed, blind spots, and how to insulate the user from ruin.`
  },
  {
    role: 'revops',
    title: 'RevOps (Revenue Operations & Data)',
    prompt: `Act as a Revenue Operations expert. Your focus is strictly on data, process efficiency, CRM pipelines, and revenue maximization. You see the world in funnels, metrics, and systems. Advise the user on how to measure what they are doing, plug leaks in their funnel, and streamline their revenue generation engine.`
  },
  {
    role: 'empreendedor',
    title: 'Empreendedor (Operator & Business)',
    prompt: `Act as a battle-tested, high-growth entrepreneur and operator. You care about execution, speed, pivot potential, and building a cash-printing machine. Analyze the situation for business model flaws, scalability, and relentless execution speed. Give advice that is aggressive and hands-on.`
  },
  {
    role: 'contador',
    title: 'Contador (Accountant & Finances)',
    prompt: `Act as a meticulous, strategic accountant. Your focus is purely on costs, taxation, cash flow predictability, margins, and financial health. Scrutinize the user's situation for unnecessary expenses, tax efficiencies, and runway. Give advice that protects the treasury.`
  },
  {
    role: 'politico',
    title: 'Politico (Politician & Lobbying)',
    prompt: `Act as a Machiavellian but diplomatic politician. Your focus is on relationships, power dynamics, institutional macro-scenarios, and lobbying. Analyze who the user needs to influence, the optics of their decisions, and how to acquire allies. Give advice on soft power and strategic positioning.`
  },
  {
    role: 'psicologo',
    title: 'Psicologo (Psychologist & Mindset)',
    prompt: `Act as a clinical psychologist and mindset coach. Your focus is the user's mental health, cognitive biases, burnout prevention, and emotional equilibrium. Analyze the situation for stress triggers, bad mental loops, and relational friction. Give advice on maintaining a bulletproof yet balanced mind.`
  },
  {
    role: 'medico',
    title: 'Medico (Doctor & Physiology)',
    prompt: `Act as a high-performance physician. Your focus is biological performance, sleep, nutrition, physiology, and longevity. If the user is working too hard, ask about cortisol. If they are sluggish, ask about health markers. Give medical/health-based advice to optimize the physical machine.`
  },
  {
    role: 'espiritual',
    title: 'Conselheiro Espiritual (Spiritual Guide)',
    prompt: `Act as a wise, grounding spiritual counselor. Your focus is on purpose, intuition, morality, and inner peace. Strip away the material noise and ask if the user's actions align with their soul and legacy. Give advice that forces deep reflection and calm.`
  },
  {
    role: 'amoroso',
    title: 'Conselheiro Amoroso (Love & Relationships)',
    prompt: `Act as an expert in emotional and romantic relationships. Your focus is on romantic harmony, family connection, and preventing the pursuit of success from destroying personal life. Analyze how the user's situation affects their spouse/partner and family. Give advice on maintaining intimate bonds.`
  },
  {
    role: 'mecanico',
    title: 'Mecanico (Mechanic & Infrastructure)',
    prompt: `Act as a highly experienced mechanic. Your literal focus is cars and motorcycles, but you speak in mechanical analogies. Analyze the infrastructure, maintenance needs, and "engine wear" of whatever the user is dealing with. Tell them when to change the oil, check the brakes, or when the engine is overheating.`
  },
  {
    role: 'economista',
    title: 'Economista (Economist & Macro)',
    prompt: `Act as a macro-economist and capital allocator. Your focus is on macro trends, interest rates, inflation, capital investment, and market cycles. Analyze whether the user is fighting the current or riding it. Give advice on asset allocation and reading the wider market.`
  }
];

export const ceoSystemPrompt = `You are the CEO Consolidator (Balys Core) of an AI MasterMind Council.
11 domain experts have reviewed the user's situation and provided specialized insights.
Your job is to synthesize their advice, filter contradictory noise, make hard decisions, and output a clean, structured, actionable CEO Directive.
Do not regurgitate each advisor. Be the boss. Give the final verdict.`;

const ceoModeratorPrompt = `You are the CEO Moderator (Balys Core) of an AI MasterMind Council.
The advisors have debated over multiple rounds. Your job is to choose the correct ending mode:
- clarification: the council lacks material information and the responsible next move is to ask the user 2-4 targeted questions.
- plan: there is enough information to propose a concrete action plan, but the user should validate tradeoffs or adjust constraints.
- verdict: the council has strong enough alignment to give a direct recommendation.

Start your answer with exactly:
MODE: clarification|plan|verdict
DIRECTIVE:

Then write the user-facing directive. It should feel decisive, practical, and natural. If you choose clarification, ask only high-leverage questions. If you choose plan, include next steps and ask what the user would adjust. If you choose verdict, make the call and explain the why briefly.`;

export type CouncilMode = 'cheap' | 'best';
export type CouncilFinalMode = 'clarification' | 'plan' | 'verdict';

export interface CouncilAdvice {
  role: string;
  title: string;
  advice: string;
  round: number;
}

export interface CouncilTranscriptEntry {
  round: number | 'ceo';
  phase: 'initial' | 'refinement' | 'cross_examination' | 'ceo';
  role: string;
  speaker: string;
  content: string;
}

export interface CouncilResult {
  individualAdvice: CouncilAdvice[];
  ceoDirective: string;
  finalMode: CouncilFinalMode;
  roundsRun: number;
  councilMode: CouncilMode;
  transcript: CouncilTranscriptEntry[];
}

export interface CouncilPipelineOptions {
  mode?: CouncilMode;
  provider?: 'openai';
  maxRounds?: number;
  onProgress?: (event: { type: string; [key: string]: unknown }) => void;
}

type OpenAIClient = InstanceType<typeof OpenAI>;

type CouncilMember = typeof councilMembers[number];

export async function runAiCouncilPipeline(
  contextText: string,
  providerOrOptions: 'openai' | CouncilPipelineOptions = 'openai'
): Promise<CouncilResult> {
  const options = normalizeOptions(providerOrOptions);
  const councilMode = options.mode || 'cheap';
  const maxRounds = Math.min(Math.max(options.maxRounds || 3, 1), 3);
  const openai = createOpenAIClient();
  const transcript: CouncilTranscriptEntry[] = [];

  const initialResults = await runAdvisorRound({
    openai,
    contextText,
    round: 1,
    phase: 'initial',
    tool: 'council.round_1',
    startSummary: '11 advisors are reviewing the situation independently.',
    endSummary: 'Initial reports completed.',
    userPrompt: (member) => `Analyze the following context from your domain. Keep it concise, concrete, and decision-oriented.\n\n${contextText}`,
    onProgress: options.onProgress,
  });
  transcript.push(...toTranscript(initialResults, 'initial'));

  if (councilMode === 'cheap' || maxRounds === 1) {
    const megaContext = buildMegaContext(contextText, [
      ['Round 1 - independent advisor reports', initialResults],
    ]);
    const directiveText = await runCeoPhase(megaContext, initialResults, ceoSystemPrompt, options.onProgress);
    const parsed = parseCeoDirective(directiveText, 'verdict');
    transcript.push({
      round: 'ceo',
      phase: 'ceo',
      role: 'ceo',
      speaker: 'CEO Moderator',
      content: parsed.directive,
    });
    return {
      individualAdvice: initialResults,
      ceoDirective: parsed.directive,
      finalMode: parsed.mode,
      roundsRun: 1,
      councilMode,
      transcript,
    };
  }

  const roundOneContext = formatAdviceList(initialResults);
  const refinedResults = await runAdvisorRound({
    openai,
    contextText,
    round: 2,
    phase: 'refinement',
    tool: 'council.round_2',
    startSummary: 'Advisors are reading the other reports and refining their positions.',
    endSummary: 'Refined positions completed.',
    userPrompt: (member) => `Original situation:\n${contextText}\n\nRound 1 reports:\n${roundOneContext}\n\nYou are ${member.title}. Refine your advice after reading the others. Include:
1. Your updated stance.
2. The strongest disagreement or blind spot you see.
3. One question you would ask another advisor if needed.
Keep it under 220 words.`,
    onProgress: options.onProgress,
  });
  transcript.push(...toTranscript(refinedResults, 'refinement'));

  let latestResults = refinedResults;
  let roundsRun = 2;
  let shouldContinue = maxRounds >= 3;
  if (shouldContinue) {
    shouldContinue = await decideIfCrossExaminationNeeded(openai, contextText, initialResults, refinedResults, options.onProgress);
  }

  if (shouldContinue && maxRounds >= 3) {
    const debateContext = buildMegaContext(contextText, [
      ['Round 1 - independent advisor reports', initialResults],
      ['Round 2 - refined positions and questions', refinedResults],
    ]);
    const crossResults = await runAdvisorRound({
      openai,
      contextText,
      round: 3,
      phase: 'cross_examination',
      tool: 'council.cross_examination',
      startSummary: 'Advisors are cross-examining the sharpest disagreements.',
      endSummary: 'Cross-examination completed.',
      userPrompt: (member) => `Original situation:\n${contextText}\n\nCouncil debate so far:\n${debateContext}\n\nYou are ${member.title}. Address the sharpest disagreement, missing information, or question aimed at your domain. You may speak directly to another advisor by title. Keep it under 180 words.`,
      onProgress: options.onProgress,
    });
    transcript.push(...toTranscript(crossResults, 'cross_examination'));
    latestResults = crossResults;
    roundsRun = 3;
  }

  const megaContext = buildMegaContext(contextText, [
    ['Round 1 - independent advisor reports', initialResults],
    ['Round 2 - refined positions and questions', refinedResults],
    ...(roundsRun >= 3 ? [['Round 3 - cross-examination', latestResults] as [string, CouncilAdvice[]]] : []),
  ]);
  const directiveText = await runCeoPhase(megaContext, latestResults, ceoModeratorPrompt, options.onProgress);
  const parsed = parseCeoDirective(directiveText, 'plan');
  transcript.push({
    round: 'ceo',
    phase: 'ceo',
    role: 'ceo',
    speaker: 'CEO Moderator',
    content: parsed.directive,
  });

  return {
    individualAdvice: latestResults,
    ceoDirective: parsed.directive,
    finalMode: parsed.mode,
    roundsRun,
    councilMode,
    transcript,
  };
}

function normalizeOptions(providerOrOptions: 'openai' | CouncilPipelineOptions): CouncilPipelineOptions {
  if (typeof providerOrOptions === 'string') return { provider: providerOrOptions };
  return providerOrOptions || {};
}

function createOpenAIClient(): OpenAIClient | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function runAdvisorRound(args: {
  openai: OpenAIClient | null;
  contextText: string;
  round: number;
  phase: CouncilTranscriptEntry['phase'];
  tool: string;
  startSummary: string;
  endSummary: string;
  userPrompt: (member: CouncilMember) => string;
  onProgress?: CouncilPipelineOptions['onProgress'];
}): Promise<CouncilAdvice[]> {
  const callId = emitStart(args.onProgress, args.tool, {
    round: args.round,
    summary: args.startSummary,
  });
  const results = await Promise.all(councilMembers.map(async (member) => {
    const advice = await callAdvisor(args.openai, member, args.userPrompt(member));
    const result = { role: member.role, title: member.title, advice, round: args.round };
    emitVoice(args.onProgress, args.phase, result);
    return result;
  }));
  emitEnd(args.onProgress, args.tool, callId, {
    status: 'council_phase',
    summary: args.endSummary,
    advisors: results.length,
    round: args.round,
  });
  return results;
}

async function callAdvisor(openai: OpenAIClient | null, member: CouncilMember, userPrompt: string): Promise<string> {
  if (!openai) return 'Unavailable at the moment (missing OPENAI_API_KEY).';
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        { role: 'system', content: member.prompt },
        { role: 'user', content: userPrompt },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() || 'No advice provided.';
  } catch (e: any) {
    const msg = e?.response?.data?.error?.message || e?.message || String(e);
    console.error(`[Council] Error in module ${member.role}:`, msg);
    return `Unavailable at the moment (${msg}).`;
  }
}

async function decideIfCrossExaminationNeeded(
  openai: OpenAIClient | null,
  contextText: string,
  initialResults: CouncilAdvice[],
  refinedResults: CouncilAdvice[],
  onProgress?: CouncilPipelineOptions['onProgress'],
): Promise<boolean> {
  const callId = emitStart(onProgress, 'council.alignment', {
    summary: 'CEO is checking whether the council needs cross-examination.',
  });
  if (!openai) {
    emitEnd(onProgress, 'council.alignment', callId, {
      status: 'council_phase',
      summary: 'No CEO alignment check available; continuing debate.',
      decision: 'continue',
    });
    return true;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `You are the CEO moderator. Decide whether this council needs one final cross-examination round. Return exactly "CONTINUE: <reason>" or "STOP: <reason>". Continue if there are unresolved risks, contradictions, or missing perspectives. Stop if alignment is strong and no extra advisor debate is likely to improve the directive.`,
        },
        {
          role: 'user',
          content: buildMegaContext(contextText, [
            ['Round 1', initialResults],
            ['Round 2', refinedResults],
          ]),
        },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim() || '';
    const continueDebate = !/^STOP\b/i.test(text);
    emitEnd(onProgress, 'council.alignment', callId, {
      status: 'council_phase',
      summary: summarizeForReceipt(text || (continueDebate ? 'Continuing debate.' : 'Stopping early.')),
      decision: continueDebate ? 'continue' : 'stop',
    });
    return continueDebate;
  } catch (e: any) {
    const msg = e?.response?.data?.error?.message || e?.message || String(e);
    console.error('[Council] Alignment check failed:', msg);
    emitEnd(onProgress, 'council.alignment', callId, {
      status: 'council_phase',
      summary: 'Alignment check failed; continuing debate.',
      decision: 'continue',
    });
    return true;
  }
}

async function runCeoPhase(
  megaContext: string,
  latestResults: CouncilAdvice[],
  systemPrompt: string,
  onProgress?: CouncilPipelineOptions['onProgress'],
): Promise<string> {
  const callId = emitStart(onProgress, 'council.ceo', {
    summary: 'CEO Moderator is deciding whether to ask, plan, or give a verdict.',
  });
  const directive = await consolidateWithFallbacks(megaContext, latestResults, systemPrompt);
  emitEnd(onProgress, 'council.ceo', callId, {
    status: 'council_phase',
    summary: summarizeForReceipt(directive),
  });
  return directive;
}

async function consolidateWithFallbacks(
  megaContext: string,
  individualResults: CouncilAdvice[],
  systemPrompt: string,
): Promise<string> {
  const errors: string[] = [];

  if (process.env.OPENAI_API_KEY) {
    const result = await tryOpenAICeo('gpt-4o-mini', megaContext, systemPrompt);
    if (result.ok) return result.text;
    errors.push(`gpt-4o-mini: ${result.reason}`);
  }

  if (process.env.OPENAI_API_KEY) {
    const result = await tryOpenAICeo('gpt-4o', megaContext, systemPrompt);
    if (result.ok) return result.text;
    errors.push(`gpt-4o: ${result.reason}`);
  }

  if (process.env.GEMINI_API_KEY) {
    const result = await tryGeminiCeo('gemini-2.5-pro', megaContext, systemPrompt);
    if (result.ok) return result.text;
    errors.push(`gemini-2.5-pro: ${result.reason}`);
  }

  console.error('[Council] All CEO providers failed. Falling back to manual synthesis. Errors:', errors);
  return buildManualSynthesis(individualResults, errors);
}

async function tryOpenAICeo(
  model: string,
  megaContext: string,
  systemPrompt: string,
): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.5,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: megaContext },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return { ok: false, reason: 'empty response' };
    return { ok: true, text };
  } catch (e: any) {
    const msg = e?.response?.data?.error?.message || e?.message || String(e);
    console.error(`[Council] OpenAI CEO ${model} failed:`, msg);
    return { ok: false, reason: msg };
  }
}

async function tryGeminiCeo(
  model: string,
  megaContext: string,
  systemPrompt: string,
): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  try {
    const apiKey = process.env.GEMINI_API_KEY!;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: megaContext }] }],
        generationConfig: { temperature: 0.5 },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: `HTTP ${res.status}: ${body.slice(0, 300)}` };
    }
    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    if (!text) return { ok: false, reason: 'empty response' };
    return { ok: true, text };
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error('[Council] Gemini CEO failed:', msg);
    return { ok: false, reason: msg };
  }
}

function buildManualSynthesis(individualResults: CouncilAdvice[], errors: string[]): string {
  const valid = individualResults.filter(r => r.advice && !r.advice.startsWith('Unavailable at the moment'));
  if (valid.length === 0) {
    return `MODE: clarification\nDIRECTIVE:\nThe council could not deliberate right now. Please try again in a few minutes. Errors: ${errors.join(' | ')}`;
  }
  const top = valid.slice(0, 5)
    .map(r => `**${r.title}**\n${r.advice.split('\n').slice(0, 6).join('\n')}`)
    .join('\n\n');
  return `MODE: plan\nDIRECTIVE:\nThe CEO consolidator is unavailable, so here is a direct synthesis from the strongest advisor reports. Treat this as a provisional plan and rerun the council for the final CEO pass when providers recover.\n\n${top}`;
}

function buildMegaContext(contextText: string, sections: Array<[string, CouncilAdvice[]]>): string {
  return [
    `USER CONTEXT:\n${contextText}`,
    ...sections.map(([title, advice]) => `--- ${title.toUpperCase()} ---\n${formatAdviceList(advice)}`),
  ].join('\n\n');
}

function formatAdviceList(advice: CouncilAdvice[]): string {
  return advice.map(res => `[${res.title}]\n${res.advice}`).join('\n\n');
}

function toTranscript(
  results: CouncilAdvice[],
  phase: CouncilTranscriptEntry['phase'],
): CouncilTranscriptEntry[] {
  return results.map((res) => ({
    round: res.round,
    phase,
    role: res.role,
    speaker: res.title,
    content: res.advice,
  }));
}

function parseCeoDirective(text: string, fallbackMode: CouncilFinalMode): { mode: CouncilFinalMode; directive: string } {
  const modeMatch = text.match(/MODE:\s*(clarification|plan|verdict)/i);
  const mode = (modeMatch?.[1]?.toLowerCase() as CouncilFinalMode | undefined) || fallbackMode;
  const directive = text
    .replace(/^\s*MODE:\s*(clarification|plan|verdict)\s*$/gim, '')
    .replace(/^\s*DIRECTIVE:\s*/gim, '')
    .trim();
  return { mode, directive: directive || text.trim() };
}

function emitStart(
  onProgress: CouncilPipelineOptions['onProgress'] | undefined,
  tool: string,
  args: Record<string, unknown>,
): string {
  const callId = createSyntheticCallId(tool);
  safeEmit(onProgress, { type: 'tool_call_start', tool, args, call_id: callId });
  return callId;
}

function emitEnd(
  onProgress: CouncilPipelineOptions['onProgress'] | undefined,
  tool: string,
  callId: string,
  receipt: Record<string, unknown>,
): void {
  safeEmit(onProgress, { type: 'tool_call_end', tool, call_id: callId, ok: true, receipt });
}

function emitVoice(
  onProgress: CouncilPipelineOptions['onProgress'] | undefined,
  phase: CouncilTranscriptEntry['phase'],
  result: CouncilAdvice,
): void {
  safeEmit(onProgress, {
    type: 'tool_call_end',
    tool: 'council.voice',
    call_id: createSyntheticCallId(`council.voice.${result.role}.${result.round}`),
    ok: true,
    receipt: {
      status: 'council_voice',
      phase,
      round: result.round,
      role: result.role,
      speaker: result.title,
      advice: result.advice,           // full text for the UI
      summary: summarizeForReceipt(result.advice), // short fallback
    },
  });
}

function safeEmit(onProgress: CouncilPipelineOptions['onProgress'] | undefined, event: { type: string; [key: string]: unknown }): void {
  try {
    onProgress?.(event);
  } catch (e) {
    console.error('[Council] onProgress threw', e);
  }
}

function createSyntheticCallId(seed: string): string {
  return `${seed}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function summarizeForReceipt(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 150) return clean;
  return `${clean.slice(0, 147).trim()}...`;
}
