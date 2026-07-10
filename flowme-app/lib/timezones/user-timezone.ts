type TimezoneProfileQuery = {
  select(columns: string): TimezoneProfileQuery;
  eq(column: string, value: string): TimezoneProfileQuery;
  maybeSingle(): Promise<{ data: { briefing_timezone?: string | null } | null; error: unknown }>;
};

type TimezoneProfileClient = {
  from(table: string): TimezoneProfileQuery;
};

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export async function resolveUserTimezone(
  supabase: unknown,
  userId: string,
  fallbackTimezone?: string | null,
): Promise<string> {
  try {
    const { data } = await (supabase as TimezoneProfileClient)
      .from('user_profile')
      .select('briefing_timezone')
      .eq('user_id', userId)
      .maybeSingle();
    if (data?.briefing_timezone && isValidTimezone(data.briefing_timezone)) return data.briefing_timezone;
  } catch {
  }
  return fallbackTimezone && isValidTimezone(fallbackTimezone) ? fallbackTimezone : 'UTC';
}
