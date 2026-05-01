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
    title: 'Político (Politician & Lobbying)',
    prompt: `Act as a Machiavellian but diplomatic politician. Your focus is on relationships, power dynamics, institutional macro-scenarios, and lobbying. Analyze who the user needs to influence, the optics of their decisions, and how to acquire allies. Give advice on soft power and strategic positioning.`
  },
  {
    role: 'psicologo',
    title: 'Psicólogo (Psychologist & Mindset)',
    prompt: `Act as a clinical psychologist and mindset coach. Your focus is the user's mental health, cognitive biases, burnout prevention, and emotional equilibrium. Analyze the situation for stress triggers, bad mental loops, and relational friction. Give advice on maintaining a bulletproof yet balanced mind.`
  },
  {
    role: 'medico',
    title: 'Médico (Doctor & Physiology)',
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
    title: 'Mecânico (Mechanic & Infrastructure)',
    prompt: `Act as a highly experienced mechanic. Your literal focus is cars and motorcycles, but you speak in mechanical analogies. Analyze the infrastructure, maintenance needs, and "engine wear" of whatever the user is dealing with. Tell them when to change the oil, check the brakes, or when the engine is overheating.`
  },
  {
    role: 'economista',
    title: 'Economista (Economist & Macro)',
    prompt: `Act as a macro-economist and capital allocator. Your focus is on macro trends, interest rates, inflation, capital investment, and market cycles. Analyze whether the user is fighting the current or riding it. Give advice on asset allocation and reading the wider market.`
  }
];

export const ceoSystenPrompt = `You are the CEO Consolidator (Balys Core) of an AI MasterMind Council.
11 domain experts have just reviewed the user's situation and provided their specialized insights.
Your job is to:
1. Synthesize all their advice.
2. Filter out contradictory or unhelpful noise.
3. Make the hard decisions.
4. Output a clean, structured, and incredibly actionable "CEO Directive" for the user.
Do not just regurgitate what they said. Be the boss. Give the final verdict.`;

export interface CouncilResult {
  individualAdvice: { role: string; title: string; advice: string }[];
  ceoDirective: string;
}

export async function runAiCouncilPipeline(
  contextText: string,
  provider: 'openai' = 'openai'
): Promise<CouncilResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // 1. Fire off 11 parallel requests using a fast model
  const promises = councilMembers.map(async (member) => {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          { role: 'system', content: member.prompt },
          { role: 'user', content: `Analyze the following context:\n\n${contextText}` }
        ]
      });
      return {
        role: member.role,
        title: member.title,
        advice: completion.choices[0]?.message?.content || 'No advice provided.'
      };
    } catch (e: any) {
      console.error(`[Council] Error in module ${member.role}:`, e);
      return {
        role: member.role,
        title: member.title,
        advice: `Unavailable at the moment (${e.message}).`
      };
    }
  });

  const individualResults = await Promise.all(promises);

  // 2. Format Mega-Context for CEO
  let megaContext = `USER CONTEXT:\n${contextText}\n\n`;
  megaContext += `--- COUNCIL MEMBER REPORTS ---\n`;
  individualResults.forEach(res => {
    megaContext += `\n[${res.title}]\n${res.advice}\n`;
  });

  // 3. Fire off the CEO call using a stronger model
  let ceoDirective = '';
  try {
    const ceoCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.5,
      messages: [
        { role: 'system', content: ceoSystenPrompt },
        { role: 'user', content: megaContext }
      ]
    });
    ceoDirective = ceoCompletion.choices[0]?.message?.content || 'Error generating CEO directive.';
  } catch (e: any) {
    console.error(`[Council] Error in CEO module:`, e);
    ceoDirective = 'The CEO could not consolidate the plan at this moment.';
  }

  return {
    individualAdvice: individualResults,
    ceoDirective
  };
}
