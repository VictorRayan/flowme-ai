import { summarizeTranscript, parseSummaryJson } from '@/lib/meetings/summarize';
import type { DiarizedSegment } from '@/lib/meetings/types';

const transcript: DiarizedSegment[] = [
  { providerLabel: 'A', startSeconds: 0, endSeconds: 4, text: 'Bom dia, vamos falar do lancamento.' },
  { providerLabel: 'B', startSeconds: 4, endSeconds: 8, text: 'Tenho a landing pronta ate sexta.' },
  { providerLabel: 'A', startSeconds: 8, endSeconds: 12, text: 'Otimo, mando o brief hoje.' },
];

describe('parseSummaryJson', () => {
  it('parses subject/objective + per-speaker summaries + tasks', () => {
    const raw = JSON.stringify({
      subject: 'Lancamento',
      objective: 'Alinhar entregas',
      speaker_summaries: [
        { provider_label: 'A', resumo_de_falas: 'Coordena o brief.', excerpts: ['mando o brief hoje'] },
        { provider_label: 'B', resumo_de_falas: 'Vai entregar a landing.', excerpts: ['landing pronta'] },
      ],
      tasks: [
        { description: 'Entregar landing', assignee_provider_label: 'B', due_iso: '2026-06-01T15:00:00Z' },
        { description: '', assignee_provider_label: 'A', due_iso: null },
        { description: 'Mandar brief', assignee_provider_label: 'A', due_iso: null },
      ],
    });
    const out = parseSummaryJson(raw, transcript);
    expect(out.subject).toBe('Lancamento');
    expect(out.objective).toBe('Alinhar entregas');
    expect(out.speakerSummaries).toHaveLength(2);
    expect(out.speakerSummaries[0].displayLabel).toBe('Falante A');
    expect(out.speakerSummaries[0].turnCount).toBe(2);
    expect(out.speakerSummaries[1].turnCount).toBe(1);
    expect(out.tasks).toHaveLength(2); // empty-description task dropped
    expect(out.tasks[0].assigneeProviderLabel).toBe('B');
  });

  it('keeps speaker rows even if the model skipped a label', () => {
    const raw = JSON.stringify({
      subject: 's',
      objective: 'o',
      speaker_summaries: [{ provider_label: 'A', resumo_de_falas: 'Fala do A.', excerpts: [] }],
      tasks: [],
    });
    const out = parseSummaryJson(raw, transcript);
    expect(out.speakerSummaries.map((s) => s.providerLabel)).toEqual(['A', 'B']);
    expect(out.speakerSummaries[1].resumoDeFalas).toBe('');
  });

  it('rejects bad JSON so the pipeline can mark failed_stage=summarize', () => {
    expect(() => parseSummaryJson('not json', transcript)).toThrow(/valid JSON/);
  });

  it('drops assignee that does not match A/B/C... pattern (no real names)', () => {
    const raw = JSON.stringify({
      subject: 's',
      objective: 'o',
      speaker_summaries: [],
      tasks: [{ description: 'X', assignee_provider_label: 'Joao', due_iso: null }],
    });
    const out = parseSummaryJson(raw, transcript);
    expect(out.tasks[0].assigneeProviderLabel).toBeNull();
  });
});

describe('summarizeTranscript', () => {
  it('calls the model and passes the transcript text', async () => {
    const callGemini = jest.fn().mockResolvedValue(JSON.stringify({
      subject: 'X',
      objective: 'Y',
      speaker_summaries: [],
      tasks: [],
    }));
    const out = await summarizeTranscript({ transcript, meetingTitle: 'Reuniao' }, { callGemini });
    expect(callGemini).toHaveBeenCalledWith(expect.objectContaining({ model: expect.stringContaining('gemini') }));
    expect(out.subject).toBe('X');
    expect(out.objective).toBe('Y');
  });
});
