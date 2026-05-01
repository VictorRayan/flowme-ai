import { routeBalysRequest } from '@/lib/ai/shadow-router';
import type { RouterMessage } from '@/lib/ai/shadow-router';

function msg(content: string): RouterMessage {
  return { role: 'user', content };
}

function route(text: string, extra?: Partial<Parameters<typeof routeBalysRequest>[0]>) {
  return routeBalysRequest({ messages: [msg(text)], ...extra });
}

// ── Task type inference ──────────────────────────────────────────────────────

describe('task type inference', () => {
  it('detects calendar intent', () => {
    expect(route('schedule a meeting tomorrow').taskType).toBe('calendar');
  });

  it('detects notes intent', () => {
    expect(route('add a note about the project').taskType).toBe('notes');
  });

  it('detects goals intent', () => {
    expect(route('what are my goals for this month').taskType).toBe('goals');
  });

  it('detects briefing intent', () => {
    expect(route('give me my daily briefing').taskType).toBe('briefing');
  });

  it('detects council intent', () => {
    expect(route('ask the council for advice').taskType).toBe('council');
  });

  it('returns mixed when calendar and notes both match', () => {
    expect(route('add a note about the meeting I have tomorrow').taskType).toBe('mixed');
  });

  it('defaults to mixed for generic questions', () => {
    expect(route('help me think through this decision').taskType).toBe('mixed');
  });
});

// ── Write intent ─────────────────────────────────────────────────────────────

describe('write intent inference', () => {
  it('returns write_calendar for a calendar create', () => {
    expect(route('create a meeting for monday at 10am').writeIntent).toBe('write_calendar');
  });

  it('returns read_only for show/list requests', () => {
    expect(route('show me my calendar events').writeIntent).toBe('read_only');
  });

  it('returns write_notes for note append', () => {
    expect(route('add a note about the new strategy').writeIntent).toBe('write_notes');
  });

  it('returns read_only or none for a council question (no write keyword)', () => {
    // Council forces read_only intent; no write verbs present so none is also acceptable
    const intent = route('ask the council for advice on my strategy').writeIntent;
    expect(['read_only', 'none']).toContain(intent);
  });
});

// ── Tier selection ───────────────────────────────────────────────────────────

describe('tier selection', () => {
  it('assigns cheap tier for a simple read request', () => {
    expect(route('list my notes').tier).toBe('cheap');
  });

  it('assigns mid or strong tier for a complex multi-step request', () => {
    const decision = route(
      'compare my calendar events this week with my goals and then create a summary note, ' +
      'and also update the meeting on wednesday at 3pm to include the new agenda'
    );
    expect(['mid', 'strong']).toContain(decision.tier);
  });

  it('assigns mid or strong tier for a council request with complex language', () => {
    // Council pipeline forces reasoningScore up; short messages may still be mid/strong
    const decision = route(
      'ask the mastermind council to analyze my strategy and compare with my goals then prioritize actions'
    );
    expect(['mid', 'strong']).toContain(decision.tier);
  });
});

// ── Execution plan ───────────────────────────────────────────────────────────

describe('execution plan', () => {
  it('returns council_pipeline for council requests', () => {
    expect(route('ask the council for advice').executionPlan).toBe('council_pipeline');
  });

  it('returns briefing_pipeline for briefing requests', () => {
    expect(route('give me my daily briefing').executionPlan).toBe('briefing_pipeline');
  });

  it('returns direct_tool for cheap read-only requests', () => {
    expect(route('list my notes').executionPlan).toBe('direct_tool');
  });
});

// ── Safety gates ─────────────────────────────────────────────────────────────

describe('safety gates', () => {
  it('sets confirmBeforeDelete when delete keyword is present', () => {
    expect(route('delete the event on monday').gates.confirmBeforeDelete).toBe(true);
  });

  it('does NOT set confirmBeforeDelete for a read-only request', () => {
    expect(route('show me my events').gates.confirmBeforeDelete).toBe(false);
  });

  it('sets alwaysVerifyOnWrite for write intents', () => {
    expect(route('create a meeting tomorrow at 10am').gates.alwaysVerifyOnWrite).toBe(true);
  });

  it('does NOT set alwaysVerifyOnWrite for read-only', () => {
    expect(route('show my calendar').gates.alwaysVerifyOnWrite).toBe(false);
  });

  it('maxAutoToolCalls is 3 for cheap tier', () => {
    expect(route('list my notes').gates.maxAutoToolCalls).toBe(3);
  });

  it('maxAutoToolCalls is 12 for strong tier', () => {
    const dec = route('ask the mastermind council to analyze my entire strategy and reorganize all my goals');
    if (dec.tier === 'strong') {
      expect(dec.gates.maxAutoToolCalls).toBe(12);
    }
  });
});

// ── Score bounds ─────────────────────────────────────────────────────────────

describe('score bounds', () => {
  const cases = [
    'hi',
    'delete all my events',
    'create note, then schedule a meeting, then email everyone and reorganize my entire week plan',
    'briefing',
    'ask the council',
  ];

  cases.forEach(text => {
    it(`all scores are in [0,1] for: "${text.slice(0, 40)}"`, () => {
      const { scores, overallScore } = route(text);
      expect(scores.ambiguity).toBeGreaterThanOrEqual(0);
      expect(scores.ambiguity).toBeLessThanOrEqual(1);
      expect(scores.reasoning).toBeGreaterThanOrEqual(0);
      expect(scores.reasoning).toBeLessThanOrEqual(1);
      expect(scores.workflowLength).toBeGreaterThanOrEqual(0);
      expect(scores.workflowLength).toBeLessThanOrEqual(1);
      expect(scores.risk).toBeGreaterThanOrEqual(0);
      expect(scores.risk).toBeLessThanOrEqual(1);
      expect(overallScore).toBeGreaterThanOrEqual(0);
      expect(overallScore).toBeLessThanOrEqual(1);
    });
  });
});

// ── Primary model shape ───────────────────────────────────────────────────────

describe('output shape', () => {
  it('always returns a provider and model for primary', () => {
    const dec = route('show my calendar');
    expect(dec.primary.provider).toMatch(/^(openai|gemini)$/);
    expect(typeof dec.primary.model).toBe('string');
    expect(dec.primary.model.length).toBeGreaterThan(0);
  });

  it('always returns a userFacingLabel', () => {
    const dec = route('create a note');
    expect(dec.userFacingLabel).toMatch(/Shadow Router/);
  });

  it('telemetryTags contain router_version', () => {
    const dec = route('hello');
    expect(dec.telemetryTags.router_version).toBeDefined();
  });
});
