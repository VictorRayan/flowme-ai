import { buildMeetingNotification, notifyMeetingProcessed } from '@/lib/meetings/notifications';

describe('buildMeetingNotification', () => {
  it('routes to the finalize page when ready', () => {
    const p = buildMeetingNotification({ kind: 'ready', meetingId: 'm1', title: 'Reuniao' });
    expect(p.title).toContain('Reuniao');
    expect(p.url).toBe('/app/notes/meetings/m1/finalize');
    expect(p.body).toMatch(/revisar/i);
  });

  it('emits a failure message that names the failed stage', () => {
    const p = buildMeetingNotification({ kind: 'failed', meetingId: 'm1', title: 'Reuniao', failedStage: 'transcribe' });
    expect(p.body).toMatch(/transcribe/);
    expect(p.body).toMatch(/audio.+salvo|salvo/i);
    expect(p.url).toBe('/app/notes/meetings/m1/finalize');
  });

  it('emits a reanalyzed message after a correction is applied', () => {
    const p = buildMeetingNotification({ kind: 'reanalyzed', meetingId: 'm1', title: 'Reuniao' });
    expect(p.title).toMatch(/reanalisada/i);
  });

  it('truncates very long meeting titles to keep notifications readable', () => {
    const longTitle = 'x'.repeat(200);
    const p = buildMeetingNotification({ kind: 'ready', meetingId: 'm1', title: longTitle });
    expect(p.title.length).toBeLessThanOrEqual(120);
  });
});

describe('notifyMeetingProcessed', () => {
  it('passes the constructed payload to the injected sender', async () => {
    const sender = jest.fn().mockResolvedValue({ ok: true });
    const out = await notifyMeetingProcessed({
      supabase: { from: () => ({}) } as any,
      userId: 'u1',
      meetingId: 'm1',
      title: 'Reuniao',
      kind: 'ready',
      sender: sender as any,
    });
    expect(out.ok).toBe(true);
    expect(sender).toHaveBeenCalledWith(expect.anything(), 'u1', expect.objectContaining({
      title: expect.stringContaining('Reuniao'),
      url: '/app/notes/meetings/m1/finalize',
    }));
  });

  it('swallows sender errors so a missing VAPID never breaks the pipeline', async () => {
    const sender = jest.fn().mockRejectedValue(new Error('vapid not configured'));
    const out = await notifyMeetingProcessed({
      supabase: { from: () => ({}) } as any,
      userId: 'u1', meetingId: 'm1', title: 'X', kind: 'ready', sender: sender as any,
    });
    expect(out.ok).toBe(false);
  });
});
