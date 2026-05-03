import {
  buildStructuredAppendNodes,
  extractTipTapText,
  hasDuplicateKnowledgeEntry,
  mergeTipTapAppend,
  normalizePersonName,
  todayFromIso,
  toTipTapDoc,
} from '@/lib/ai/memory/knowledge-graph';

describe('knowledge graph TipTap helpers', () => {
  it('normalizes empty content to a TipTap doc', () => {
    expect(toTipTapDoc(null)).toEqual({ type: 'doc', content: [] });
    expect(toTipTapDoc({ type: 'doc', content: [] })).toEqual({ type: 'doc', content: [] });
  });

  it('builds append nodes with heading, content, and real mention nodes', () => {
    const built = buildStructuredAppendNodes({
      sectionType: 'personal_info',
      title: 'Family relationship',
      content: '@Anna is @Myself wife.',
      people: [{ id: 'person-1', name: 'Anna' }],
      selfPerson: { id: 'self-1', name: 'Victor Rayan' },
      nowIso: '2026-05-02T12:00:00.000Z',
    });

    expect(built.plainText).toContain('Family relationship - 2026-05-02');
    expect(built.plainText).toContain('@Anna is @myself wife.');
    const related = built.nodes.find((node) => node.type === 'paragraph' && node.content?.some((child) => child.type === 'mention'));
    const contentParagraph = built.nodes.find((node) => node.type === 'paragraph' && node.content?.[0]?.type === 'mention');
    expect(contentParagraph?.content?.[0]).toEqual({
      type: 'mention',
      attrs: { id: 'person-1', label: 'Anna' },
    });
    expect(contentParagraph?.content?.[2]).toEqual({
      type: 'mention',
      attrs: { id: 'self-1', label: 'Victor Rayan' },
    });
    expect(related?.content?.find((child) => child.type === 'mention')).toEqual({
      type: 'mention',
      attrs: { id: 'person-1', label: 'Anna' },
    });
  });

  it('merges append nodes without removing existing note content', () => {
    const existing = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Existing profile content.' }] }],
    };
    const built = buildStructuredAppendNodes({
      sectionType: 'fact',
      content: 'User met Anna in 2021.',
      nowIso: '2026-05-02T12:00:00.000Z',
    });

    const merged = mergeTipTapAppend(existing, built.nodes);
    expect(merged.content[0]).toEqual(existing.content[0]);
    expect(extractTipTapText(merged)).toContain('Existing profile content.');
    expect(extractTipTapText(merged)).toContain('User met Anna in 2021.');
  });

  it('detects duplicate appends from existing text or JSON content', () => {
    const built = buildStructuredAppendNodes({
      sectionType: 'marked_event',
      title: 'Important conversation',
      content: 'Victor and Anna agreed to revisit the decision in six months.',
      nowIso: '2026-05-02T12:00:00.000Z',
    });

    expect(hasDuplicateKnowledgeEntry(
      'Important conversation Victor and Anna agreed to revisit the decision in six months.',
      null,
      built.duplicateKey,
    )).toBe(true);
  });

  it('extracts text from mention nodes using the label', () => {
    const text = extractTipTapText({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Related: ' },
        { type: 'mention', attrs: { id: 'person-1', label: 'Anna' } },
      ],
    });
    expect(text).toContain('Anna');
  });

  it('does not throw when a model omits optional content', () => {
    expect(() => buildStructuredAppendNodes({
      sectionType: 'daily_briefing',
      title: 'Programmed Balys AI',
      content: undefined as unknown as string,
      nowIso: '2026-05-02T12:00:00.000Z',
    })).not.toThrow();
  });
});

describe('knowledge graph small utilities', () => {
  it('normalizes person names', () => {
    expect(normalizePersonName('  Anna   Maria  ')).toBe('Anna Maria');
  });

  it('uses the ISO date as the note date', () => {
    expect(todayFromIso('2026-05-02T23:59:59.000Z')).toBe('2026-05-02');
  });
});
