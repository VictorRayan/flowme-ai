import type { FeatureKey } from './entitlements';

const API_FEATURE_PREFIXES: Array<[string, FeatureKey]> = [
  ['/api/calendar', 'calendar'],
  ['/api/events', 'calendar'],
  ['/api/tasks', 'today'],
  ['/api/action-plans', 'goals'],
  ['/api/goals', 'goals'],
  ['/api/finance', 'finance'],
  ['/api/connectors', 'connectors'],
  ['/api/weekly-reviews', 'reviews'],
  ['/api/monthly-reviews', 'reviews'],
  ['/api/briefings', 'briefings'],
  ['/api/reminders', 'reminders'],
  ['/api/meetings', 'meetings'],
  ['/api/ai/images', 'images'],
  ['/api/whatsapp/channel', 'whatsapp'],
];

const APP_FEATURE_PATHS: Record<string, FeatureKey> = {
  '/app/notes/meetings': 'meetings',
  '/app/calendar': 'calendar',
  '/app/today': 'today',
  '/app/goals': 'goals',
  '/app/finance': 'finance',
  '/app/reviews': 'reviews',
  '/app/connectors': 'connectors',
};

export function featureForApiPath(pathname: string): FeatureKey | null {
  const match = API_FEATURE_PREFIXES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match?.[1] || null;
}

export function featureForAppPath(pathname: string): FeatureKey | null {
  const match = Object.entries(APP_FEATURE_PATHS).find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
  return match?.[1] || null;
}
