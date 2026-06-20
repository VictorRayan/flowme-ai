import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runMeetingPipeline, runReanalysis } from '@/lib/meetings/pipeline';
import { downloadFromR2 } from '@/lib/r2/storage';
import { getUserEntitlements, isFeatureAllowed } from '@/lib/billing/entitlements';
import { acquireAiUsageGuard, releaseAiUsageGuard } from '@/lib/billing/ai-guardrails';

// POST /api/cron/process-meetings — Vercel cron-triggered.
// Claims meetings whose status is 'processing' or 'reanalyzing' and runs
// the appropriate pipeline. Bearer-authenticated via CRON_SECRET.
export async function POST(req: NextRequest) {
  return run(req);
}

export async function GET(req: NextRequest) {
  return run(req);
}

async function run(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return NextResponse.json({ error: 'admin credentials missing' }, { status: 500 });
  const admin = createClient(url, serviceRoleKey);

  // 1) Run main pipeline for meetings in 'processing'
  const { data: pendingMeetings } = await admin
    .from('meeting_recordings')
    .select('id, user_id, summary')
    .eq('status', 'processing')
    .order('updated_at', { ascending: true })
    .limit(5);

  const pipelineResults: any[] = [];
  for (const m of (pendingMeetings || []) as any[]) {
    const entitlements = await getUserEntitlements(admin, m.user_id);
    if (!isFeatureAllowed(entitlements, 'meetings')) continue;
    const guard = await acquireAiUsageGuard(admin, m.user_id, 'meeting');
    if (!guard.allowed) {
      pipelineResults.push({ meeting_id: m.id, ok: false, guarded: true, retry_after_seconds: guard.retryAfterSeconds });
      continue;
    }
    const fromStage = (m.summary?.retry_from_stage as any) || 'assemble';
    try {
      const result = await runMeetingPipeline({ supabase: admin, meetingId: m.id, startFrom: fromStage });
      pipelineResults.push({ meeting_id: m.id, ok: result.ok, failedStage: result.failedStage });
    } finally {
      await releaseAiUsageGuard(admin, guard.leaseId);
    }
  }

  // 2) Run reanalysis for meetings whose status is 'reanalyzing'
  const { data: reanalyzing } = await admin
    .from('meeting_recordings')
    .select('id, user_id')
    .eq('status', 'reanalyzing')
    .order('updated_at', { ascending: true })
    .limit(5);

  const reanalysisResults: any[] = [];
  for (const m of (reanalyzing || []) as any[]) {
    const entitlements = await getUserEntitlements(admin, m.user_id);
    if (!isFeatureAllowed(entitlements, 'meetings')) continue;
    const guard = await acquireAiUsageGuard(admin, m.user_id, 'meeting');
    if (!guard.allowed) {
      reanalysisResults.push({ meeting_id: m.id, ok: false, guarded: true, retry_after_seconds: guard.retryAfterSeconds });
      continue;
    }
    const { data: pending } = await admin
      .from('meeting_speaker_corrections')
      .select('id, correction_audio_r2_key')
      .eq('meeting_recording_id', m.id)
      .eq('status', 'pending')
      .order('sequence_number', { ascending: false })
      .limit(1);
    const correction = (pending || [])[0] as any;
    if (!correction) {
      await releaseAiUsageGuard(admin, guard.leaseId);
      continue;
    }

    // Transcribe the correction audio with Gemini Flash (cheap, short clip).
    let correctionText = '';
    try {
      correctionText = await transcribeCorrectionAudio(correction.correction_audio_r2_key);
      await admin
        .from('meeting_speaker_corrections')
        .update({ correction_text: correctionText })
        .eq('id', correction.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'correction_transcribe_failed';
      await admin
        .from('meeting_speaker_corrections')
        .update({ status: 'failed', failure_reason: message })
        .eq('id', correction.id);
      await admin.from('meeting_recordings').update({ status: 'finalization_review' }).eq('id', m.id);
      reanalysisResults.push({ meeting_id: m.id, ok: false, error: message });
      await releaseAiUsageGuard(admin, guard.leaseId);
      continue;
    }

    try {
      const out = await runReanalysis({ supabase: admin, meetingId: m.id, correctionText, correctionId: correction.id });
      reanalysisResults.push({ meeting_id: m.id, ok: out.ok });
    } finally {
      await releaseAiUsageGuard(admin, guard.leaseId);
    }
  }

  return NextResponse.json({
    ok: true,
    pipeline: pipelineResults,
    reanalysis: reanalysisResults,
  });
}

async function transcribeCorrectionAudio(r2Key: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const res = await downloadFromR2(r2Key);
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) parts.push(value);
  }
  const total = parts.reduce((a, p) => a + p.byteLength, 0);
  const data = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { data.set(p, offset); offset += p.byteLength; }

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const audioPart = {
    inlineData: {
      data: Buffer.from(data).toString('base64'),
      mimeType: res.contentType || 'audio/webm',
    },
  };
  const prompt = 'Transcribe the user\'s short correction audio verbatim. Return ONLY the transcription text, no prose.';
  const result = await model.generateContent([prompt, audioPart as any]);
  const response: any = result.response;
  return String(response?.text?.() || '').trim();
}
