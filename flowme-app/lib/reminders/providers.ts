import type { ReminderChannelPreference, ReminderProviderName } from './types';

export function resolveReminderProvider(channel: ReminderChannelPreference): ReminderProviderName {
  if (channel === 'instagram') return 'manychat';
  if (channel === 'push') return 'push';
  return 'whatsapp';
}

export function providerLabel(provider: ReminderProviderName): string {
  if (provider === 'manychat') return 'Instagram';
  if (provider === 'push') return 'Push Notification';
  return 'WhatsApp';
}

