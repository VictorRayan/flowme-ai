import { memoryAppendToBriefingTool, memoryAppendToPersonTool } from '@/lib/ai/tools/memory-tools';

describe('Knowledge Graph memory tools schemas', () => {
  it('accepts related_people as plain string names for briefing appends', () => {
    const parsed = memoryAppendToBriefingTool.inputSchema.safeParse({
      title: 'Programmed Balys AI',
      related_people: ['Myself', 'Leticia'],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.related_people).toEqual([{ name: 'Leticia' }]);
    }
  });

  it('accepts person as a plain string for person appends', () => {
    const parsed = memoryAppendToPersonTool.inputSchema.safeParse({
      person: 'Leticia',
      section_type: 'personal_info',
      title: 'Relationship',
      content: 'Leticia is the user girlfriend.',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.person).toEqual({ name: 'Leticia' });
    }
  });

  it('does not fail the whole turn when append_to_person has no target person', async () => {
    const parsed = memoryAppendToPersonTool.inputSchema.safeParse({
      title: 'General event',
      content: 'The user programmed Balys AI today.',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const result = await memoryAppendToPersonTool.call(parsed.data, {
      supabase: {},
      user: { id: 'user-1' },
      timezone: 'America/Sao_Paulo',
      nowIso: '2026-05-02T12:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    expect(result.receipt).toMatchObject({
      appended: false,
      skipped_missing_person: true,
    });
  });
});
