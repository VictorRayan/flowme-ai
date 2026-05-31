// Stage 8.3 — Audio-correction reanalysis. Takes the current transcript and
// a textual correction from the user, returns a ReassignmentInstruction that
// the pipeline applies in a single transaction.

import type { DiarizedSegment, ReassignmentInstruction } from './types';

export interface ReassignInput {
  segments: Array<{ sequenceNumber: number; providerLabel: string; text: string }>;
  currentSpeakerLabels: string[];
  correctionText: string;
}

export interface ReassignAdapterOptions {
  model?: string;
  callGemini?: (opts: { model: string; prompt: string }) => Promise<string>;
}

const REASSIGN_PROMPT = `You are reviewing a meeting transcript. The user
listened to it and pointed out a diarization mistake. Your job is to
re-attribute segments without re-transcribing anything.

You receive:
- The current segments, each with a sequence_number and a provider_label
  (a letter like A, B, C, ...).
- The user's verbatim correction (what they said in their correction audio).

Return STRICT JSON (no markdown):
{
  "merges": [
    { "from": ["A", "B"], "into": "A" }
  ],
  "reassignments": [
    { "segment_sequence_numbers": [3, 4, 5], "to_provider_label": "B" }
  ]
}

RULES:
- merges collapse two or more provider_labels into one. Order matters: "into"
  is the label that survives.
- reassignments move specific segments to a different label.
- If the correction is ambiguous, return empty arrays.
- Do not invent new labels: every label must already exist in the current
  segments.
- Do not modify segment text.
- Return JSON only.`;

export async function reassignSpeakers(
  input: ReassignInput,
  options: ReassignAdapterOptions = {},
): Promise<ReassignmentInstruction> {
  const model = options.model || 'gemini-2.5-flash';
  const callGemini = options.callGemini || defaultCallGemini;

  const segmentsText = input.segments
    .map((s) => `#${s.sequenceNumber} [Speaker ${s.providerLabel}] ${s.text}`)
    .join('\n');

  const prompt = `${REASSIGN_PROMPT}\n\nCURRENT LABELS: ${input.currentSpeakerLabels.join(', ')}\nUSER CORRECTION: ${input.correctionText}\n\nSEGMENTS:\n${segmentsText}`;
  const raw = await callGemini({ model, prompt });
  return parseReassignmentJson(raw, input.currentSpeakerLabels, input.segments.map((s) => s.sequenceNumber));
}

export function parseReassignmentJson(
  raw: string,
  knownLabels: string[],
  knownSequenceNumbers: number[],
): ReassignmentInstruction {
  let parsed: any = null;
  try { parsed = JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = null; } }
  }
  if (!parsed) throw new Error('Reassignment response was not valid JSON');

  const knownLabelSet = new Set(knownLabels.map((l) => l.toUpperCase()));
  const knownSeqSet = new Set(knownSequenceNumbers);

  const rawMerges = Array.isArray(parsed.merges) ? parsed.merges : [];
  const merges: Array<{ from: string[]; into: string }> = [];
  for (const m of rawMerges) {
    if (!m || typeof m !== 'object') continue;
    const into = String(m.into || '').trim().toUpperCase();
    const from = Array.isArray(m.from)
      ? m.from.map((x: unknown) => String(x).trim().toUpperCase()).filter((x: string) => knownLabelSet.has(x))
      : [];
    if (!knownLabelSet.has(into) || from.length === 0) continue;
    const uniqueFrom = from.filter((x: string) => x !== into);
    if (uniqueFrom.length === 0) continue;
    merges.push({ from: uniqueFrom, into });
  }

  const rawReassignments = Array.isArray(parsed.reassignments) ? parsed.reassignments : [];
  const reassignments: Array<{ segmentSequenceNumbers: number[]; toProviderLabel: string }> = [];
  for (const r of rawReassignments) {
    if (!r || typeof r !== 'object') continue;
    const to = String(r.to_provider_label || r.toProviderLabel || '').trim().toUpperCase();
    if (!knownLabelSet.has(to)) continue;
    const seqs = Array.isArray(r.segment_sequence_numbers || r.segmentSequenceNumbers)
      ? (r.segment_sequence_numbers || r.segmentSequenceNumbers).map((x: unknown) => Number(x)).filter((n: number) => Number.isInteger(n) && knownSeqSet.has(n))
      : [];
    if (seqs.length === 0) continue;
    reassignments.push({ segmentSequenceNumbers: seqs, toProviderLabel: to });
  }

  return { merges, reassignments };
}

export function applyReassignment(
  segments: Array<{ sequenceNumber: number; providerLabel: string; text: string }>,
  instruction: ReassignmentInstruction,
): Array<{ sequenceNumber: number; providerLabel: string; text: string }> {
  // Build a label-mapping after all merges.
  const labelMap = new Map<string, string>();
  for (const merge of instruction.merges) {
    for (const f of merge.from) labelMap.set(f, merge.into);
  }
  // Compose mappings so chain merges work (A→B, B→C should land at C).
  const resolveLabel = (label: string): string => {
    let current = label;
    const visited = new Set<string>();
    while (labelMap.has(current) && !visited.has(current)) {
      visited.add(current);
      current = labelMap.get(current)!;
    }
    return current;
  };

  const seqOverrides = new Map<number, string>();
  for (const r of instruction.reassignments) {
    for (const seq of r.segmentSequenceNumbers) {
      seqOverrides.set(seq, resolveLabel(r.toProviderLabel));
    }
  }

  return segments.map((s) => ({
    sequenceNumber: s.sequenceNumber,
    text: s.text,
    providerLabel: seqOverrides.get(s.sequenceNumber) ?? resolveLabel(s.providerLabel),
  }));
}

async function defaultCallGemini(opts: { model: string; prompt: string }): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: opts.model, generationConfig: { responseMimeType: 'application/json' } });
  const result = await model.generateContent(opts.prompt);
  const response: any = result.response;
  return response?.text?.() || '';
}
