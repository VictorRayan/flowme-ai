import fs from 'node:fs';
import path from 'node:path';
import { BrowserContext, Page, expect, test } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { google } from 'googleapis';

export const E2E_EMAIL = process.env.E2E_USER_EMAIL || 'victorrayansouzaramos@gmail.com';
export const E2E_TIMEZONE = 'America/Sao_Paulo';

type TestUser = {
  id: string;
  email?: string;
};

type CalendarLinkRow = {
  linked_account_id: string;
  provider_event_id: string;
  title: string;
};

export function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

export function requireRealE2EEnv() {
  loadEnv();
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
  ];
  const missing = required.filter((key) => !process.env[key]);
  test.skip(missing.length > 0, `Missing real E2E env vars: ${missing.join(', ')}`);
}

export function getAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function getTestUser(admin: SupabaseClient): Promise<TestUser> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((entry) => entry.email === E2E_EMAIL);
  if (!user) throw new Error(`E2E user not found: ${E2E_EMAIL}`);
  return user as TestUser;
}

export async function authenticateBrowser(context: BrowserContext, admin: SupabaseClient) {
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: E2E_EMAIL,
  });
  if (linkError) throw linkError;

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: verified, error: verifyError } = await authClient.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink',
  });
  if (verifyError) throw verifyError;
  if (!verified.session) throw new Error('Supabase did not return a session for E2E user');

  const jar: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return jar; },
        setAll(cookies) {
          for (const cookie of cookies) jar.push(cookie);
        },
      },
    },
  );
  const { error } = await ssr.auth.setSession({
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
  });
  if (error) throw error;

  await context.addCookies(jar.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: Boolean(cookie.options?.httpOnly),
    secure: false,
    sameSite: 'Lax' as const,
  })));
}

export async function createOnboardingPlan(page: Page, prefix: string) {
  const milestone = `${prefix} - Validar título contextual em eventos do onboarding`;
  const response = await page.request.post('/api/v1/onboarding/complete', {
    data: {
      morningTime: '08:00',
      eveningTime: '20:00',
      timezone: E2E_TIMEZONE,
      goalProposals: [{
        annual_smart_goal: `${prefix} - Lançar o Flowme com usuários pagantes até dezembro`,
        monthly_milestone: milestone,
        weekly_routine: 'Dedicar para às 10:00 por 30 minutos todos os dias',
        preferred_time: '10:00',
        default_task_duration_minutes: 30,
      }],
    },
  });
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBe(true);
  expect(body.calendar_events_created).toBe(1);
  expect(body.calendar_event_links_failed).toBe(0);
  return {
    milestone,
    raw: body,
  };
}

export async function findCalendarLink(admin: SupabaseClient, userId: string, prefix: string): Promise<CalendarLinkRow> {
  const { data, error } = await admin
    .from('goal_calendar_events')
    .select('linked_account_id, provider_event_id, title')
    .eq('user_id', userId)
    .ilike('title', `%${prefix}%`)
    .limit(1);
  if (error) throw error;
  if (!data?.[0]) throw new Error(`No calendar link found for prefix "${prefix}"`);
  return data[0] as CalendarLinkRow;
}

export async function getGoogleEventSummary(admin: SupabaseClient, link: CalendarLinkRow): Promise<string> {
  const auth = await getGoogleAuth(admin, link.linked_account_id);
  const event = await google.calendar({ version: 'v3', auth }).events.get({
    calendarId: 'primary',
    eventId: link.provider_event_id,
  });
  return event.data.summary || '';
}

export async function cleanupE2EData(admin: SupabaseClient, userId: string, prefix: string) {
  const { data: links } = await admin
    .from('goal_calendar_events')
    .select('linked_account_id, provider_event_id, title')
    .eq('user_id', userId)
    .ilike('title', `%${prefix}%`);

  for (const link of links || []) {
    try {
      const auth = await getGoogleAuth(admin, link.linked_account_id);
      await google.calendar({ version: 'v3', auth }).events.delete({
        calendarId: 'primary',
        eventId: link.provider_event_id,
      });
    } catch (error: any) {
      if (![404, 410].includes(error?.code || error?.status)) throw error;
    }
  }

  await admin.from('goal_calendar_events').delete().eq('user_id', userId).ilike('title', `%${prefix}%`);
  await admin.from('action_plan_tasks').delete().eq('user_id', userId).ilike('title', `%${prefix}%`);

  const { data: plans } = await admin
    .from('action_plans')
    .select('id')
    .eq('user_id', userId)
    .ilike('title', `%${prefix}%`);
  const planIds = (plans || []).map((plan) => plan.id);
  if (planIds.length > 0) {
    await admin.from('action_plan_tasks').delete().eq('user_id', userId).in('action_plan_id', planIds);
    await admin.from('action_plan_goal_links').delete().eq('user_id', userId).in('action_plan_id', planIds);
    await admin.from('action_plans').delete().eq('user_id', userId).in('id', planIds);
  }

  const { data: goals } = await admin
    .from('smart_goals')
    .select('id')
    .eq('user_id', userId)
    .ilike('title', `%${prefix}%`);
  const goalIds = (goals || []).map((goal) => goal.id);
  if (goalIds.length > 0) await admin.from('smart_goals').delete().eq('user_id', userId).in('id', goalIds);
}

async function getGoogleAuth(admin: SupabaseClient, linkedAccountId: string) {
  const { data: token, error } = await admin
    .from('user_google_tokens')
    .select('*')
    .eq('linked_account_id', linkedAccountId)
    .single();
  if (error) throw error;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  oauth2Client.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expiry_date: new Date(token.expiry).getTime(),
  });

  if (Date.now() >= new Date(token.expiry).getTime() - 5 * 60 * 1000) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    await admin
      .from('user_google_tokens')
      .update({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || token.refresh_token,
        expiry: new Date(credentials.expiry_date!).toISOString(),
      })
      .eq('linked_account_id', linkedAccountId);
    oauth2Client.setCredentials(credentials);
  }

  return oauth2Client;
}
