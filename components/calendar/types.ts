export interface CalendarEvent {
  source: 'google' | 'microactivity';
  id: string;
  provider_event_id?: string | null;
  linked_account_id?: string;
  account_name?: string;
  account_type?: 'work' | 'personal';
  title: string;
  description?: string | null;
  start_at: string; // ISO
  end_at?: string | null; // ISO
  meet_link?: string | null;
  participants?: Array<{ email: string; displayName?: string }>;
  location?: string | null;
  htmlLink?: string | null;
  reminders?: { useDefault: boolean; overrides?: Array<{ method: string; minutes: number }> };
}
