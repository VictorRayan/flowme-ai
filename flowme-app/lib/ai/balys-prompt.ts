import fs from 'fs';
import path from 'path';

export const SYSTEM_PROMPT_DYNAMIC_BOUNDARY = '\n\n<!-- BALYS_DYNAMIC_BOUNDARY -->\n\n';

let cachedBalysSpec: string | null = null;

function loadBalysSpec(): string {
  if (cachedBalysSpec !== null) return cachedBalysSpec;
  try {
    const filePath = path.join(process.cwd(), 'BALYS.md');
    cachedBalysSpec = fs.readFileSync(filePath, 'utf-8');
  } catch {
    cachedBalysSpec = `You are Balys, a personal AI assistant. Be helpful, direct, and conversational. Use the tools provided to read or modify the user's data when relevant. Never fabricate.`;
  }
  return cachedBalysSpec;
}

export interface BalysPromptInput {
  nowSection: string;
  language?: string;
  systemAddendum?: string;
  notesMap?: string;
  toolsAvailable: string[];
  profileBlock?: string;
  factsBlock?: string;
}

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  pt: 'Portuguese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  ja: 'Japanese',
  zh: 'Chinese',
};

export function buildBalysSystemPrompt(input: BalysPromptInput): string {
  const stable: string[] = [];
  const dynamic: string[] = [];

  stable.push(loadBalysSpec());

  if (input.toolsAvailable.length > 0) {
    stable.push(
      `## Tools loaded this session\n\nYou have these tool namespaces available: ${input.toolsAvailable.join(', ')}.\n\nThe full tool schemas are provided to you separately — read each tool's description and use them when the user's request matches. You are never restricted to one domain per turn; chain tools across domains freely.`
    );
  }

  // Order matters. Tier C (profile) is mandatory and always first.
  // Then Tier A (facts), then runtime context.
  if (input.profileBlock && input.profileBlock.trim()) {
    dynamic.push(input.profileBlock.trim());
  }

  if (input.factsBlock && input.factsBlock.trim()) {
    dynamic.push(input.factsBlock.trim());
  }

  if (input.language && LANG_NAMES[input.language]) {
    dynamic.push(`The user's configured interface language is ${LANG_NAMES[input.language]}. You MUST reply in ${LANG_NAMES[input.language]} unless the latest user message explicitly asks for a different response language. Do not switch languages just because prior tool output, email content, document content, or search results are in another language. If you need to quote source material in another language, keep the quote short and explain it in ${LANG_NAMES[input.language]}.`);
  } else if (input.language) {
    dynamic.push(`The user's configured interface language is ${input.language}. You MUST reply in ${input.language} unless the latest user message explicitly asks for a different response language. Do not switch languages because tool output is in another language.`);
  }

  dynamic.push(`## Response quality gate

Before writing the final answer, silently verify:
- Did you answer the user's actual goal, not just a nearby topic?
- If the request needs current app data, did you use tools or clearly ask for the missing context?
- If a connector result is needed, did you read the actual content before analyzing it?
- If the request is ambiguous or risky, did you ask the shortest useful clarifying question?
- Is the final answer in the configured language unless the latest user message explicitly asked otherwise?
- Actions happen through tool calls ONLY. Never tell the user you are doing or have done something ("estou apagando", "criei o evento") unless the corresponding tool call ran in THIS turn and its receipt confirms it. If you ran out of steps mid-plan, say exactly what was done and what still needs a follow-up message — never announce work you did not execute.

If any answer is "no", fix the response before sending it. Never mention this checklist to the user.`);

  if (input.nowSection) {
    dynamic.push(input.nowSection);
  }

  if (input.notesMap && input.notesMap.trim()) {
    dynamic.push(input.notesMap);
  }

  if (input.systemAddendum && input.systemAddendum.trim()) {
    dynamic.push(input.systemAddendum);
  }

  return [stable.join('\n\n'), dynamic.join('\n\n')]
    .filter((part) => part.trim().length > 0)
    .join(SYSTEM_PROMPT_DYNAMIC_BOUNDARY);
}

export function _resetBalysSpecCacheForTests(): void {
  cachedBalysSpec = null;
}
