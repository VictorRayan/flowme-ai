// Stage 3 helper: generate subject, objective, per-speaker resumo de falas
// and task suggestions from the diarized transcript.

import type { DiarizedSegment, MeetingSpeakerSummary, MeetingTaskSuggestion } from './types';

export interface SummarizeInput {
  transcript: DiarizedSegment[];
  meetingTitle: string;
  participantsHint?: string[];
}

export interface SummarizeResult {
  subject: string;
  objective: string;
  speakerSummaries: MeetingSpeakerSummary[];
  tasks: MeetingTaskSuggestion[];
}

export interface SummarizeAdapterOptions {
  model?: string;
  callGemini?: (opts: { model: string; prompt: string }) => Promise<string>;
}

const SUMMARIZE_PROMPT = `You receive a diarized meeting transcript.

Return STRICT JSON with this shape (no markdown):
{
  "subject": "<short subject of the meeting>",
  "objective": "<short objective of the meeting>",
  "speaker_summaries": [
    {
      "provider_label": "A",
      "resumo_de_falas": "2 to 4 sentences in the meeting language summarizing what THIS speaker said.",
      "excerpts": ["...", "..."]
    }
  ],
  "tasks": [
    { "description": "...", "assignee_provider_label": "A" | null, "due_iso": "2026-06-01T15:00:00Z" | null }
  ]
}

RULES:
- Use the same language as the transcript (Portuguese by default).
- speaker_summaries must include every distinct provider_label that appears
  in the transcript, with NO real names — keep the A/B/C labels.
- resumo_de_falas is short, factual, third-person.
- excerpts: 2 short verbatim quotes from that speaker, ≤120 chars each.
- tasks: extract concrete commitments that were stated in the transcript.
  Skip vague statements. Return [] if there are no real commitments.
- Do NOT invent participants, dates or commitments.
- Return JSON only.`;

export async function summarizeTranscript(
  input: SummarizeInput,
  options: SummarizeAdapterOptions = {},
): Promise<SummarizeResult> {
  const model = options.model || 'gemini-2.5-flash';
  const callGemini = options.callGemini || defaultCallGemini;

  const transcriptText = input.transcript
    .map((s) => `[Speaker ${s.providerLabel}] (${s.startSeconds.toFixed(1)}-${s.endSeconds.toFixed(1)}s) ${s.text}`)
    .join('\n');

  const prompt = `${SUMMARIZE_PROMPT}\n\nMEETING TITLE: ${input.meetingTitle}\n${input.participantsHint?.length ? `PARTICIPANTS HINT (do not use as names): ${input.participantsHint.join(', ')}\n` : ''}\nTRANSCRIPT:\n${transcriptText}`;

  const raw = await callGemini({ model, prompt });
  return parseSummaryJson(raw, input.transcript);
}

export function parseSummaryJson(raw: string, transcript: DiarizedSegment[]): SummarizeResult {
  let parsed: any = null;
  try { parsed = JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = null; } }
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Summary response was not valid JSON');

  const subject = String(parsed.subject || '').trim();
  const objective = String(parsed.objective || '').trim();

  const speakerStats = computeSpeakerStats(transcript);
  const speakerSummaries: MeetingSpeakerSummary[] = [];
  const rawSpeakers = Array.isArray(parsed.speaker_summaries) ? parsed.speaker_summaries : [];

  for (const speaker of Object.keys(speakerStats)) {
    const match = rawSpeakers.find((s: any) => String(s?.provider_label || '').trim().toUpperCase() === speaker);
    const resumoDeFalas = String(match?.resumo_de_falas || '').trim();
    const excerpts = Array.isArray(match?.excerpts)
      ? match.excerpts.filter((e: unknown) => typeof e === 'string').map((e: string) => e.trim()).filter(Boolean).slice(0, 3)
      : [];
    speakerSummaries.push({
      speakerId: '', // populated when stored
      providerLabel: speaker,
      displayLabel: `Falante ${speaker}`,
      resumoDeFalas,
      excerpts,
      turnCount: speakerStats[speaker].turnCount,
      totalSpokenSeconds: speakerStats[speaker].totalSeconds,
    });
  }

  const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  const tasks: MeetingTaskSuggestion[] = [];
  for (const t of rawTasks) {
    if (!t || typeof t !== 'object') continue;
    const description = String(t.description || '').trim();
    if (!description) continue;
    const assignee = t.assignee_provider_label === null || t.assignee_provider_label === undefined
      ? null
      : String(t.assignee_provider_label).trim().toUpperCase();
    const due = t.due_iso ? String(t.due_iso) : null;
    tasks.push({ description, assigneeProviderLabel: assignee && /^[A-Z]\d*$/.test(assignee) ? assignee : null, dueIso: due });
  }

  return { subject, objective, speakerSummaries, tasks };
}

function computeSpeakerStats(transcript: DiarizedSegment[]): Record<string, { turnCount: number; totalSeconds: number }> {
  const out: Record<string, { turnCount: number; totalSeconds: number }> = {};
  for (const s of transcript) {
    if (!out[s.providerLabel]) out[s.providerLabel] = { turnCount: 0, totalSeconds: 0 };
    out[s.providerLabel].turnCount += 1;
    out[s.providerLabel].totalSeconds += Math.max(0, s.endSeconds - s.startSeconds);
  }
  return out;
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
