import { parseReassignmentJson, applyReassignment, reassignSpeakers } from '@/lib/meetings/reassign';

const segments = [
  { sequenceNumber: 1, providerLabel: 'A', text: 'A1' },
  { sequenceNumber: 2, providerLabel: 'B', text: 'B1' },
  { sequenceNumber: 3, providerLabel: 'A', text: 'A2' },
  { sequenceNumber: 4, providerLabel: 'C', text: 'C1' },
];

describe('parseReassignmentJson', () => {
  it('keeps only merges whose labels exist', () => {
    const raw = JSON.stringify({
      merges: [
        { from: ['B'], into: 'A' },
        { from: ['Z'], into: 'A' }, // dropped — Z not in known labels
        { from: ['A'], into: 'A' }, // dropped — self-merge
      ],
      reassignments: [],
    });
    const out = parseReassignmentJson(raw, ['A', 'B', 'C'], [1, 2, 3, 4]);
    expect(out.merges).toEqual([{ from: ['B'], into: 'A' }]);
  });

  it('keeps only reassignments with known sequence numbers and a known target label', () => {
    const raw = JSON.stringify({
      merges: [],
      reassignments: [
        { segment_sequence_numbers: [1, 3, 999], to_provider_label: 'C' },
        { segment_sequence_numbers: [2], to_provider_label: 'X' }, // dropped
      ],
    });
    const out = parseReassignmentJson(raw, ['A', 'B', 'C'], [1, 2, 3, 4]);
    expect(out.reassignments).toEqual([
      { segmentSequenceNumbers: [1, 3], toProviderLabel: 'C' },
    ]);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseReassignmentJson('garbage', ['A'], [1])).toThrow(/valid JSON/);
  });
});

describe('applyReassignment', () => {
  it('applies a simple merge (B → A)', () => {
    const out = applyReassignment(segments, {
      merges: [{ from: ['B'], into: 'A' }],
      reassignments: [],
    });
    expect(out.map((s) => s.providerLabel)).toEqual(['A', 'A', 'A', 'C']);
  });

  it('applies chain merges (A → B, B → C resolves to C)', () => {
    const out = applyReassignment(segments, {
      merges: [
        { from: ['A'], into: 'B' },
        { from: ['B'], into: 'C' },
      ],
      reassignments: [],
    });
    expect(out.map((s) => s.providerLabel)).toEqual(['C', 'C', 'C', 'C']);
  });

  it('applies segment-level reassignments after merges', () => {
    const out = applyReassignment(segments, {
      merges: [{ from: ['B'], into: 'A' }],
      reassignments: [{ segmentSequenceNumbers: [3], toProviderLabel: 'C' }],
    });
    expect(out).toEqual([
      { sequenceNumber: 1, providerLabel: 'A', text: 'A1' },
      { sequenceNumber: 2, providerLabel: 'A', text: 'B1' },
      { sequenceNumber: 3, providerLabel: 'C', text: 'A2' },
      { sequenceNumber: 4, providerLabel: 'C', text: 'C1' },
    ]);
  });

  it('never modifies segment text', () => {
    const out = applyReassignment(segments, {
      merges: [{ from: ['B'], into: 'A' }],
      reassignments: [{ segmentSequenceNumbers: [2], toProviderLabel: 'C' }],
    });
    expect(out.map((s) => s.text)).toEqual(['A1', 'B1', 'A2', 'C1']);
  });
});

describe('reassignSpeakers (integration)', () => {
  it('calls the model with the user correction and returns a validated instruction', async () => {
    const callGemini = jest.fn().mockResolvedValue(JSON.stringify({
      merges: [{ from: ['B'], into: 'A' }],
      reassignments: [],
    }));
    const out = await reassignSpeakers({
      segments,
      currentSpeakerLabels: ['A', 'B', 'C'],
      correctionText: 'Falante B e Falante A sao a mesma pessoa',
    }, { callGemini });
    expect(callGemini).toHaveBeenCalledWith(expect.objectContaining({ model: expect.stringContaining('gemini') }));
    expect(out.merges).toEqual([{ from: ['B'], into: 'A' }]);
  });
});
