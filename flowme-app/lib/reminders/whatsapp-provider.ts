import { sendText } from '@/lib/whatsapp/evolution-client';
import type { ReminderProvider } from './types';

type SupabaseError = { message: string };
type MaybeSingleQuery<T> = {
  select(columns: string): MaybeSingleQuery<T>;
  eq(column: string, value: unknown): MaybeSingleQuery<T>;
  maybeSingle(): Promise<{ data: T | null; error: SupabaseError | null }>;
};
type SupabaseLike = {
  from(table: string): unknown;
};

type WhatsappChannel = {
  phone: string;
  status: string;
  reminders_enabled?: boolean | null;
};

export function createWhatsappReminderProvider(supabase: SupabaseLike): ReminderProvider {
  return {
    name: 'whatsapp',
    async send(input) {
      const query = supabase.from('whatsapp_channels') as MaybeSingleQuery<WhatsappChannel>;
      const { data, error } = await query
        .select('phone, status, reminders_enabled')
        .eq('user_id', input.userId)
        .eq('status', 'active')
        .eq('reminders_enabled', true)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data?.phone) throw new Error('No active WhatsApp reminder channel.');

      await sendText(data.phone, input.message);
      return {};
    },
  };
}

