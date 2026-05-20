export type ReminderStatus = 'scheduled' | 'sent' | 'cancelled' | 'failed';
export type ReminderChannelPreference = 'default' | 'whatsapp' | 'instagram' | 'push';
export type ReminderProviderName = 'whatsapp' | 'manychat' | 'push';
export type ReminderCreatedBy = 'balys' | 'user' | 'system';

export type ReminderSource = {
  type: 'calendar_event';
  provider: 'google_calendar';
  id: string;
  title?: string | null;
  start_at?: string | null;
};

export type ReminderRecord = {
  id: string;
  user_id: string;
  title: string | null;
  message: string;
  scheduled_for: string;
  timezone: string;
  status: ReminderStatus;
  channel_preference: ReminderChannelPreference;
  source_type: 'calendar_event' | null;
  source_provider: 'google_calendar' | null;
  source_id: string | null;
  source_title: string | null;
  source_start_at: string | null;
  created_by: ReminderCreatedBy;
  dedupe_key: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CreateReminderInput = {
  title?: string | null;
  message: string;
  scheduled_for: string;
  timezone?: string | null;
  channel_preference?: ReminderChannelPreference;
  source?: ReminderSource | null;
  created_by?: ReminderCreatedBy;
  dedupe_key?: string | null;
};

export type ListRemindersFilters = {
  status?: ReminderStatus;
  source_type?: 'calendar_event';
  source_id?: string;
  start_iso?: string;
  end_iso?: string;
  limit?: number;
};

export type SendReminderResult = {
  providerMessageId?: string;
};

export type ReminderProvider = {
  name: ReminderProviderName;
  send(input: {
    userId: string;
    reminderId: string;
    message: string;
    scheduledFor: string;
  }): Promise<SendReminderResult>;
};

