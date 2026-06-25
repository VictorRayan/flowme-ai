import { DOCS_EDITOR_AGENT_SYSTEM } from '@/lib/ai/agents/docs-agent';
import { SHEETS_ECONOMIST_AGENT_SYSTEM } from '@/lib/ai/agents/sheets-agent';

describe('connector specialist agent prompts', () => {
  it('defines the Google Docs agent as an editorial specialist that can create and manage content', () => {
    expect(DOCS_EDITOR_AGENT_SYSTEM).toContain('Google Docs Editorial Agent');
    expect(DOCS_EDITOR_AGENT_SYSTEM).toContain('senior editor');
    expect(DOCS_EDITOR_AGENT_SYSTEM).toContain('Content creation');
    expect(DOCS_EDITOR_AGENT_SYSTEM).toContain('Google Docs API');
    expect(DOCS_EDITOR_AGENT_SYSTEM).toContain('Multilingual writing');
    expect(DOCS_EDITOR_AGENT_SYSTEM).toContain('Meeting minutes');
    expect(DOCS_EDITOR_AGENT_SYSTEM).toContain('action items');
  });

  it('defines the Google Sheets agent as a financial economist with layout and formatting awareness', () => {
    expect(SHEETS_ECONOMIST_AGENT_SYSTEM).toContain('Google Sheets Financial Economist Agent');
    expect(SHEETS_ECONOMIST_AGENT_SYSTEM).toContain('financial markets economist');
    expect(SHEETS_ECONOMIST_AGENT_SYSTEM).toContain('Formatting intelligence');
    expect(SHEETS_ECONOMIST_AGENT_SYSTEM).toContain('Insight discipline');
    expect(SHEETS_ECONOMIST_AGENT_SYSTEM).toContain('Google Sheets API');
    expect(SHEETS_ECONOMIST_AGENT_SYSTEM).toContain('Orientation intelligence');
    expect(SHEETS_ECONOMIST_AGENT_SYSTEM).toContain('Expense entry intelligence');
    expect(SHEETS_ECONOMIST_AGENT_SYSTEM).toContain('Multi-tab intelligence');
  });
});
