import { mergeMeetingBlockIntoNote, renderMeetingTipTapDoc } from '@/lib/meetings/finalize';

describe('meeting finalization note content', () => {
  it('renders meeting text as TipTap paragraphs so the Notes editor displays it', () => {
    const doc = renderMeetingTipTapDoc('Reunião: Planejamento\n\nTranscrição\n@Victor: Vamos começar.', [
      { id: 'person-1', name: 'Victor' },
    ]);

    expect(doc).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Reunião: Planejamento' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'Transcrição' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { id: 'person-1', label: 'Victor' } },
            { type: 'text', text: ': Vamos começar.' },
          ],
        },
      ],
    });
  });

  it('appends the meeting to both TipTap content and searchable text', () => {
    const result = mergeMeetingBlockIntoNote({
      existingContent: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Meu dia' }] }] },
      existingText: 'Meu dia',
      meetingTitle: 'Planejamento',
      meetingBlock: 'Reunião: Planejamento\n\nObjetivo\nDefinir prioridades',
      mentionedPeople: [],
    });

    expect(result.content.content).toHaveLength(6);
    expect(result.contentText).toContain('Meu dia\n\n--- Reunião: Planejamento ---');
    expect(result.contentText).toContain('Definir prioridades');
  });

  it('does not append the same meeting twice', () => {
    const existingText = '--- Reunião: Planejamento ---\nReunião: Planejamento';
    const result = mergeMeetingBlockIntoNote({
      existingContent: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: existingText }] }] },
      existingText,
      meetingTitle: 'Planejamento',
      meetingBlock: 'Reunião: Planejamento',
      mentionedPeople: [],
    });

    expect(result.appended).toBe(false);
    expect(result.contentText).toBe(existingText);
  });
});
