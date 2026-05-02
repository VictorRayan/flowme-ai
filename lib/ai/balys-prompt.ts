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
    dynamic.push(`The user's preferred language is ${LANG_NAMES[input.language]}. Reply in that language unless the user clearly switches.`);
  } else if (input.language) {
    dynamic.push(`The user's preferred language is ${input.language}. Reply in that language unless the user clearly switches.`);
  }

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
