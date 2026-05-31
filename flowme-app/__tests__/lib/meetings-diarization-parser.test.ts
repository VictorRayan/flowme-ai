import { parseDiarizedJson, mergeAdjacentSameSpeaker } from '@/lib/meetings/diarization-parser';

describe('parseDiarizedJson', () => {
  it('parses a clean response with multiple speakers', () => {
    const raw = JSON.stringify({
      detected_language: 'pt',
      segments: [
        { speaker: 'A', start_s: 0, end_s: 4, text: 'Bom dia.' },
        { speaker: 'B', start_s: 4, end_s: 8, text: 'Bom dia. Vamos comecar?' },
      ],
    });
    const out = parseDiarizedJson(raw);
    expect(out.detectedLanguage).toBe('pt');
    expect(out.segments).toHaveLength(2);
    expect(out.segments[0].providerLabel).toBe('A');
  });

  it('extracts JSON when the model wrapped it in extra prose', () => {
    const raw = `Sure! Here is the result:\n\n{"detected_language":"pt","segments":[{"speaker":"A","start_s":0,"end_s":2,"text":"oi"}]}\n\nLet me know if you need more.`;
    const out = parseDiarizedJson(raw);
    expect(out.segments).toHaveLength(1);
  });

  it('rejects responses where the model invented a real name as the speaker label', () => {
    const raw = JSON.stringify({
      detected_language: 'pt',
      segments: [{ speaker: 'Anna', start_s: 0, end_s: 2, text: 'oi' }],
    });
    expect(() => parseDiarizedJson(raw)).toThrow(/real-looking name/i);
  });

  it('rejects empty / invalid JSON', () => {
    expect(() => parseDiarizedJson('')).toThrow(/Empty diarization/);
    expect(() => parseDiarizedJson('not json')).toThrow(/valid JSON/);
    expect(() => parseDiarizedJson('{"segments": []}')).toThrow(/zero segments/);
  });

  it('drops segments with invalid timestamps or empty text', () => {
    const raw = JSON.stringify({
      segments: [
        { speaker: 'A', start_s: 0, end_s: 2, text: '' },
        { speaker: 'B', start_s: 5, end_s: 3, text: 'invertido' },
        { speaker: 'C', start_s: 'x', end_s: 1, text: 'nan' },
        { speaker: 'D', start_s: 1, end_s: 2, text: 'ok' },
      ],
    });
    const out = parseDiarizedJson(raw);
    expect(out.segments).toHaveLength(1);
    expect(out.segments[0].providerLabel).toBe('D');
  });
});

describe('mergeAdjacentSameSpeaker', () => {
  it('joins back-to-back segments from the same speaker', () => {
    const out = mergeAdjacentSameSpeaker([
      { providerLabel: 'A', startSeconds: 0, endSeconds: 3, text: 'Oi' },
      { providerLabel: 'A', startSeconds: 3.2, endSeconds: 5, text: 'tudo bem?' },
      { providerLabel: 'B', startSeconds: 5.5, endSeconds: 7, text: 'sim' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe('Oi tudo bem?');
    expect(out[0].endSeconds).toBe(5);
  });

  it('does not merge across longer gaps', () => {
    const out = mergeAdjacentSameSpeaker([
      { providerLabel: 'A', startSeconds: 0, endSeconds: 3, text: 'Oi' },
      { providerLabel: 'A', startSeconds: 10, endSeconds: 12, text: 'ainda aqui?' },
    ]);
    expect(out).toHaveLength(2);
  });
});
