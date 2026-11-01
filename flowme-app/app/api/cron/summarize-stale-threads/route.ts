import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { summarizeAndPersistThread, type ThreadMessage } from '@/lib/ai/memory/recall';
import { callProfileUpdater, loadProfile, persistProfile } from '@/lib/ai/memory/profile';

/**
 * Stale-thread summarizer cron.
 *
 * Runs daily. Finds threads whose summary (or absence of one) is older than
 * the latest message AND whose latest message is >1h old. Re-summarizes them
 * using the server-side persisted thread_messages.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase admin credentials missing' }, { status: 500 });
  }
  const admin = createClient(url, serviceRoleKey);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Get up to 50 threads whose last message is >1h old.
  const { data: candidateThreads, error: threadsErr } = await admin
    .from('threads')
    .select('id, user_id, last_message_at')
    .lt('last_message_at', oneHourAgo)
    .eq('is_archived', false)
    .order('last_message_at', { ascending: true })
    .limit(50);

  if (threadsErr) {
    console.error('[cron/summarize-stale-threads] threads select error:', threadsErr);
    return NextResponse.json({ error: threadsErr.message }, { status: 500 });
  }
  if (!candidateThreads || candidateThreads.length === 0) {
    return NextResponse.json({ ok: true, refreshed: 0, message: 'no stale threads' });
  }

  // For each thread, decide if it needs re-summarization:
  // - no summary yet, OR
  // - summary's summarized_at is older than the thread's last_message_at.
  let refreshed = 0;
  let skipped = 0;
  let profilesUpdated = 0;

  for (const t of candidateThreads) {
    const { data: existingSummary } = await admin
      .from('thread_summaries')
      .select('summarized_at')
      .eq('user_id', t.user_id)
      .eq('thread_id', t.id)
      .maybeSingle();

    if (existingSummary && new Date(existingSummary.summarized_at).getTime() >= new Date(t.last_message_at).getTime()) {
      skipped++;
      continue;
    }

    const { data: rows, error: msgErr } = await admin
      .from('thread_messages')
      .select('role, content')
      .eq('user_id', t.user_id)
      .eq('thread_id', t.id)
      .order('created_at', { ascending: true })
      .limit(60);

    if (msgErr) {
      console.error('[cron/summarize-stale-threads] messages select error:', msgErr);
      skipped++;
      continue;
    }
    if (!rows || rows.length < 4) {
      skipped++;
      continue;
    }

    const messages: ThreadMessage[] = rows.map((r: any) => ({
      role: r.role as 'user' | 'assistant',
      content: r.content || '',
    }));

    await summarizeAndPersistThread(admin, t.user_id, t.id, messages);
    refreshed++;

    try {
      const currentProfile = await loadProfile(admin, t.user_id);
      const transcriptText = messages
        .slice(-30)
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n');
      const profileResult = await callProfileUpdater({
        current: currentProfile,
        conversationText: transcriptText,
      });
      if (profileResult.changed) {
        await persistProfile(admin, t.user_id, profileResult.updated);
        profilesUpdated++;
      }
    } catch (profileErr) {
      console.error('[cron/summarize-stale-threads] profile update error:', profileErr);
    }
  }

  return NextResponse.json({
    ok: true,
    inspected: candidateThreads.length,
    refreshed,
    profiles_updated: profilesUpdated,
    skipped,
  });
}
