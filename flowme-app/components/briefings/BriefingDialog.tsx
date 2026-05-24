'use client';

import * as React from 'react';
import {
  Dialog, DialogTitle, DialogContent, IconButton, Typography, Box, Stack, Skeleton, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import EventIcon from '@mui/icons-material/Event';
import FlagIcon from '@mui/icons-material/Flag';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import ForumIcon from '@mui/icons-material/Forum';

export interface BriefingSectionResult<T> { ok: boolean; data: T | null; error?: string }
export interface WeatherSection { temperature_c: number; condition: string; city: string }
export interface CalendarEventLite { title: string; start_at: string; end_at?: string | null; location?: string | null }
export interface CalendarSection { events: CalendarEventLite[] }
export interface GoalSection { title: string; status: string; progress?: number }
export interface NewsItem { title: string; summary: string; url?: string | null; source?: string | null }
export interface NewsSection { by_topic: Array<{ topic: string; items: NewsItem[] }> }
export interface TrendItem { topic: string; summary: string; signals: Array<{ quote: string }> }
export interface TrendsSection { trends: TrendItem[] }

export interface BriefingSections {
  weather: BriefingSectionResult<WeatherSection>;
  calendar: BriefingSectionResult<CalendarSection>;
  goal: BriefingSectionResult<GoalSection>;
  news: BriefingSectionResult<NewsSection>;
  trends: BriefingSectionResult<TrendsSection>;
}

interface BriefingDialogProps {
  open: boolean;
  onClose: () => void;
  greetingTitle: string;
  loading?: boolean;
  sections?: BriefingSections | null;
  uiLang?: 'pt' | 'en';
}

const COPY = {
  pt: {
    weather: 'Como tá lá fora',
    calendar: 'Sua agenda',
    goal: 'Meta de hoje',
    news: 'Pra ficar por dentro',
    trends: 'No ar agora',
    empty: 'Sem dados pra esse item agora',
    weather_fmt: (w: WeatherSection) => `${w.condition || 'Clima'} · ${Math.round(w.temperature_c)}°C em ${w.city}`,
    no_events: 'Sua agenda está livre',
  },
  en: {
    weather: 'Outside right now',
    calendar: 'Your day',
    goal: 'Today\'s goal',
    news: 'In the world',
    trends: 'Buzz right now',
    empty: 'Nothing here right now',
    weather_fmt: (w: WeatherSection) => `${w.condition || 'Weather'} · ${Math.round(w.temperature_c)}°C in ${w.city}`,
    no_events: 'Your day is open',
  },
} as const;

function SectionShell({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Box sx={{ color: '#a5b4fc', display: 'inline-flex' }}>{icon}</Box>
        <Typography sx={{ color: '#a5b4fc', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</Typography>
      </Stack>
      <Box sx={{ pl: 0.5 }}>{children}</Box>
    </Box>
  );
}

function SectionSkeleton() {
  return (
    <Stack spacing={1} sx={{ pl: 0.5 }}>
      <Skeleton variant="text" width="80%" sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
      <Skeleton variant="text" width="60%" sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
    </Stack>
  );
}

function timeLabel(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

export default function BriefingDialog({ open, onClose, greetingTitle, loading, sections, uiLang = 'pt' }: BriefingDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const t = COPY[uiLang];

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth aria-labelledby="briefing-dialog-title" PaperProps={{ sx: { bgcolor: '#0f1117', backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0f1117 70%)' } }}>
      <DialogTitle id="briefing-dialog-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', fontWeight: 700 }}>
        {greetingTitle}
        <IconButton onClick={onClose} aria-label="Fechar" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        {loading && !sections && (
          <Stack spacing={3}>
            <SectionSkeleton /><SectionSkeleton /><SectionSkeleton />
          </Stack>
        )}

        {sections && (
          <Box>
            <SectionShell icon={<WbSunnyIcon fontSize="small" />} title={t.weather}>
              {sections.weather.ok && sections.weather.data
                ? <Typography sx={{ color: '#fff' }}>{t.weather_fmt(sections.weather.data)}</Typography>
                : <Typography sx={{ color: 'text.disabled' }}>{t.empty}</Typography>}
            </SectionShell>

            <SectionShell icon={<EventIcon fontSize="small" />} title={t.calendar}>
              {sections.calendar.ok && sections.calendar.data && sections.calendar.data.events.length > 0 ? (
                <Stack spacing={0.75}>
                  {sections.calendar.data.events.slice(0, 5).map((e, idx) => (
                    <Typography key={idx} sx={{ color: '#fff' }}>
                      <Box component="span" sx={{ color: '#a5b4fc', fontWeight: 600, mr: 1 }}>{timeLabel(e.start_at)}</Box>
                      {e.title}
                    </Typography>
                  ))}
                </Stack>
              ) : (
                <Typography sx={{ color: 'text.disabled' }}>{t.no_events}</Typography>
              )}
            </SectionShell>

            <SectionShell icon={<FlagIcon fontSize="small" />} title={t.goal}>
              {sections.goal.ok && sections.goal.data
                ? <Typography sx={{ color: '#fff' }}>{sections.goal.data.title}</Typography>
                : <Typography sx={{ color: 'text.disabled' }}>{t.empty}</Typography>}
            </SectionShell>

            <SectionShell icon={<NewspaperIcon fontSize="small" />} title={t.news}>
              {sections.news.ok && sections.news.data && sections.news.data.by_topic.some((bt) => bt.items.length > 0) ? (
                <Stack spacing={1.25}>
                  {sections.news.data.by_topic.flatMap((bt) => bt.items).slice(0, 6).map((item, idx) => (
                    <Box key={idx}>
                      <Typography sx={{ color: '#fff', fontWeight: 600 }}>{item.title}</Typography>
                      <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{item.summary}</Typography>
                      {item.url && (
                        <Typography component="a" href={item.url} target="_blank" rel="noopener noreferrer" sx={{ color: '#a5b4fc', fontSize: 12, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                          {item.source || (uiLang === 'pt' ? 'Ler mais' : 'Read more')}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography sx={{ color: 'text.disabled' }}>{t.empty}</Typography>
              )}
            </SectionShell>

            <SectionShell icon={<ForumIcon fontSize="small" />} title={t.trends}>
              {sections.trends.ok && sections.trends.data && sections.trends.data.trends.length > 0 ? (
                <Stack spacing={1}>
                  {sections.trends.data.trends.slice(0, 5).map((tr, idx) => (
                    <Box key={idx}>
                      <Typography sx={{ color: '#fff', fontWeight: 600 }}>{tr.topic}</Typography>
                      <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{tr.summary}</Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography sx={{ color: 'text.disabled' }}>{t.empty}</Typography>
              )}
            </SectionShell>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
