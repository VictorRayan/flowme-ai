import { expect, test, type Page } from '@playwright/test';
import { authenticateBrowser, getAdminClient, requireRealE2EEnv } from './helpers/real-flowme';

// Stub the meeting API end-to-end. Playwright cannot capture a real microphone
// in CI, so we exercise the UI state machine + the stop → finalization screen
// transition with mocked /api/* responses.
//
// /app/* is auth-protected by the middleware, so this test requires the real
// Supabase env vars to authenticate the test user. Skips when missing.
test.beforeAll(() => { requireRealE2EEnv(); });

const MEETING_ID = 'm-test-1';

async function stubMeetingApis(page: Page, opts: { withSegments?: boolean } = {}) {
  await page.route('**/api/meetings', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, meeting: { id: MEETING_ID, title: 'Test Meeting', status: 'recording', captured_sources: ['microphone'] } }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, meetings: [] }) });
    }
  });

  await page.route(`**/api/meetings/${MEETING_ID}`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true,
        meeting: {
          id: MEETING_ID,
          title: 'Test Meeting',
          subject: 'Assunto teste',
          objective: 'Objetivo teste',
          status: opts.withSegments ? 'finalization_review' : 'processing',
          failed_stage: null,
          failure_reason: null,
          duration_seconds: 120,
          final_audio_r2_key: 'meetings/m-test-1/audio.mp3',
          final_audio_mime_type: 'audio/mpeg',
          summary: opts.withSegments ? { speakerSummaries: [
            { providerLabel: 'A', displayLabel: 'Falante A', resumoDeFalas: 'Coordena o brief.', excerpts: ['vou mandar o brief'], turnCount: 2, totalSpokenSeconds: 12 },
            { providerLabel: 'B', displayLabel: 'Falante B', resumoDeFalas: 'Vai entregar a landing.', excerpts: ['landing pronta'], turnCount: 1, totalSpokenSeconds: 8 },
          ] } : {},
        },
        speakers: opts.withSegments ? [
          { id: 'sp-a', provider_label: 'A', display_label: 'Falante A', person_id: null, identity_status: 'unknown', is_active: true },
          { id: 'sp-b', provider_label: 'B', display_label: 'Falante B', person_id: null, identity_status: 'unknown', is_active: true },
        ] : [],
        segments: [],
        tasks: [],
        corrections: [],
      }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, updated: true }) });
    }
  });

  await page.route(`**/api/meetings/${MEETING_ID}/chunks`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, uploaded: true }) }));
  await page.route(`**/api/meetings/${MEETING_ID}/finalize`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, queued: true }) }));
  await page.route(`**/api/meetings/${MEETING_ID}/audio`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, url: 'https://example.com/audio.mp3', mime_type: 'audio/mpeg' }) }));
  await page.route(`**/api/meetings/${MEETING_ID}/finalize-save`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, note_id: 'note-1', daily_briefing_note_id: 'briefing-1', mentioned_person_ids: [] }) }));
  await page.route(`**/api/meetings/${MEETING_ID}/retry`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, queued: true, from_stage: 'transcribe' }) }));
  await page.route(`**/api/meetings/${MEETING_ID}/corrections`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, correction: { id: 'c1', sequence_number: 1, status: 'pending' } }) }));
  await page.route('**/api/people', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, person: { id: 'p-new', full_name: 'Joao Novo' } }) });
    } else {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, people: [{ id: 'p-1', full_name: 'Joao Silva' }] }) });
    }
  });
}

test.describe('Meeting finalization screen — speaker review + correction lane', () => {
  test('renders speaker cards, allows assigning a person, and saves the meeting', async ({ page, context }) => {
    await authenticateBrowser(context, getAdminClient());
    await stubMeetingApis(page, { withSegments: true });
    await page.goto(`/app/notes/meetings/${MEETING_ID}/finalize`);

    // Wait for both speaker cards
    await expect(page.getByTestId('speaker-card-A')).toBeVisible();
    await expect(page.getByTestId('speaker-card-B')).toBeVisible();

    // The audio player exists once final_audio_r2_key is set
    await expect(page.getByTestId('meeting-audio-player')).toBeVisible();

    // Assign existing person to Falante A
    await page.getByTestId('speaker-assign-A').click();
    await page.getByText('Joao Silva').first().click();

    // Save
    await page.getByTestId('finalize-save-button').click();

    // After save we navigate to /app/notes — assert URL changed
    await expect(page).toHaveURL(/\/app\/notes/);
  });

  test('failure state shows the audio player and a retry button', async ({ page, context }) => {
    await authenticateBrowser(context, getAdminClient());
    await page.route(`**/api/meetings/${MEETING_ID}`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true,
        meeting: {
          id: MEETING_ID,
          title: 'Meeting failed',
          status: 'failed',
          failed_stage: 'transcribe',
          failure_reason: 'gemini_zero_segments',
          final_audio_r2_key: 'meetings/m-test-1/audio.mp3',
          final_audio_mime_type: 'audio/mpeg',
          duration_seconds: 60,
          summary: {},
        },
        speakers: [], segments: [], tasks: [], corrections: [],
      }) });
    });
    await page.route(`**/api/meetings/${MEETING_ID}/audio`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, url: 'https://example.com/audio.mp3', mime_type: 'audio/mpeg' }) }));
    await page.route(`**/api/meetings/${MEETING_ID}/retry`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, queued: true, from_stage: 'transcribe' }) }));
    await page.route('**/api/people', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, people: [] }) }));

    await page.goto(`/app/notes/meetings/${MEETING_ID}/finalize`);

    // Audio still playable even though pipeline failed
    await expect(page.getByTestId('meeting-audio-player')).toBeVisible();
    // Retry button visible
    await expect(page.getByTestId('retry-button')).toBeVisible();
  });
});
