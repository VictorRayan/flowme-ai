import { Tool } from './Tool';
import { calendarCreateEventTool, calendarDeleteEventTool, calendarDeleteEventsBatchTool, calendarListEventsTool, calendarUpdateEventTool } from './calendar-tools';
import { connectorsListTool, connectorsReadSheetTool, connectorsReadDocTool, connectorsFindAndReadDocTool, connectorsReadDriveFileTool, connectorsSearchDocsTool, connectorsCreateDocTool, connectorsSheetsAgentTool, connectorsDocsAgentTool, gmailCreateDraftTool, gmailReadMessageTool, gmailSearchMessagesTool } from './connectors-tools';
import { notesCreateTool, notesListTool, notesEditTool } from './notes-tools';
import { councilConveneTool } from './council-tools';
import { peopleSearchTool } from './people-tools';
import { memoryAppendToBriefingTool, memoryAppendToPersonTool, memorySaveFactTool, memoryRecallThreadsTool } from './memory-tools';
import { goalsCreateOperatingPlanTool, goalsCreateShortActionPlanTool, goalsListTool } from './goals-tools';
import { weatherGetTool } from './weather-tools';

export const ALL_TOOLS: Tool[] = [
  calendarListEventsTool,
  calendarCreateEventTool,
  calendarUpdateEventTool,
  calendarDeleteEventTool,
  calendarDeleteEventsBatchTool,
  connectorsListTool,
  connectorsReadSheetTool,
  connectorsReadDocTool,
  connectorsFindAndReadDocTool,
  connectorsSearchDocsTool,
  connectorsReadDriveFileTool,
  connectorsCreateDocTool,
  connectorsSheetsAgentTool,
  connectorsDocsAgentTool,
  gmailSearchMessagesTool,
  gmailReadMessageTool,
  gmailCreateDraftTool,
  notesCreateTool,
  notesListTool,
  notesEditTool,
  councilConveneTool,
  peopleSearchTool,
  goalsListTool,
  goalsCreateOperatingPlanTool,
  goalsCreateShortActionPlanTool,
  memorySaveFactTool,
  memoryRecallThreadsTool,
  memoryAppendToPersonTool,
  memoryAppendToBriefingTool,
  weatherGetTool,
];

const TOOL_DOMAIN_PREFIXES: Record<string, string> = {
  calendar: 'calendar.',
  gmail: 'gmail.',
  connectors: 'connectors.',
  notes: 'notes.',
  council: 'council.',
  people: 'people.',
  memory: 'memory.',
  goals: 'goals.',
  weather: 'weather.',
};

export function getToolsByDomain(domain: 'calendar' | 'gmail' | 'connectors' | 'notes' | 'council' | 'people' | 'goals' | 'weather' | 'all' | 'none'): Tool[] {
  if (domain === 'none') return [];
  if (domain === 'all') return ALL_TOOLS;
  const prefix = TOOL_DOMAIN_PREFIXES[domain];
  if (!prefix) return [];
  return ALL_TOOLS.filter((tool) => tool.name.startsWith(prefix));
}

export function getToolByName(name: string): Tool | undefined {
  return ALL_TOOLS.find(t => t.name === name);
}

export function getActiveToolDomains(): string[] {
  const domains = new Set<string>();
  for (const tool of ALL_TOOLS) {
    const dot = tool.name.indexOf('.');
    if (dot > 0) domains.add(tool.name.slice(0, dot));
  }
  return Array.from(domains).sort();
}
