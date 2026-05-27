export type BriefingSlot = 'morning' | 'afternoon' | 'evening';

export interface BriefingSectionResult<T> {
  ok: boolean;
  data: T | null;
  error?: string;
}

export interface WeatherSection {
  temperature_c: number;
  feels_like_c?: number | null;
  precipitation_mm?: number | null;
  weather_code?: number | null;
  is_day?: boolean | null;
  condition: string;
  city: string;
  advice?: string | null;
}

export interface CalendarEventLite {
  title: string;
  start_at: string;
  end_at?: string | null;
  location?: string | null;
}

export interface CalendarSection {
  events: CalendarEventLite[];
}

export interface GoalSection {
  title: string;
  status: string;
  progress?: number;
}

export interface NewsItem {
  title: string;
  summary: string;
  url?: string | null;
  source?: string | null;
}

export interface NewsSection {
  by_topic: Array<{ topic: string; items: NewsItem[] }>;
}

export interface TrendItem {
  topic: string;
  headline?: string;
  subheadline?: string;
  url?: string | null;
  summary: string;
  signals: Array<{ quote: string; url?: string | null }>;
}

export interface TrendsSection {
  trends: TrendItem[];
}

export interface BriefingSections {
  weather: BriefingSectionResult<WeatherSection>;
  calendar: BriefingSectionResult<CalendarSection>;
  goal: BriefingSectionResult<GoalSection>;
  news: BriefingSectionResult<NewsSection>;
  trends: BriefingSectionResult<TrendsSection>;
}

export interface BriefingRecord {
  id: string;
  user_id: string;
  slot: BriefingSlot;
  briefing_date: string;
  sections: BriefingSections;
  generated_at: string;
  delivered_at: string | null;
  channels_delivered: string[];
}
