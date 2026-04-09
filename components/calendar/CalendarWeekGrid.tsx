import { useMemo, useRef, useEffect } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import dayjs from 'dayjs';
import { CalendarEvent } from './types';
import TaskAltIcon from '@mui/icons-material/TaskAlt';

interface CalendarWeekGridProps {
  currentDate: dayjs.Dayjs;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onEventDrop?: (eventId: string, newStart: string, newEnd?: string) => void;
}

const HOUR_HEIGHT = 60;

function eventColors(isMicro: boolean, isWork: boolean) {
  if (isMicro) return { bg: 'rgba(52,211,153,0.18)',  fg: '#6ee7b7', border: 'rgba(52,211,153,0.35)',  bar: '#34d399' };
  if (isWork)  return { bg: 'rgba(139,92,246,0.18)',  fg: '#c4b5fd', border: 'rgba(139,92,246,0.35)',  bar: '#8b5cf6' };
  return         { bg: 'rgba(99,102,241,0.18)',        fg: '#a5b4fc', border: 'rgba(99,102,241,0.35)',  bar: '#6366f1' };
}

export default function CalendarWeekGrid({ currentDate, events, onEventClick, onEventDrop }: CalendarWeekGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_HEIGHT;
  }, []);

  const weekDates = useMemo(() => {
    const start = currentDate.startOf('week');
    return Array.from({ length: 7 }, (_, i) => start.add(i, 'day'));
  }, [currentDate]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach(evt => {
      const key = dayjs(evt.start_at).format('YYYY-MM-DD');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(evt);
    });
    return map;
  }, [events]);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const nowMinutes = dayjs().hour() * 60 + dayjs().minute();
  const todayStr = dayjs().format('YYYY-MM-DD');

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', height: '100%',
      border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden',
      bgcolor: 'background.paper',
    }}>
      {/* Header row */}
      <Box sx={{
        display: 'flex', borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: 'rgba(99,102,241,0.06)',
        flexShrink: 0,
      }}>
        <Box sx={{ width: 60, flexShrink: 0, borderRight: '1px solid', borderColor: 'divider' }} />
        <Box sx={{ display: 'flex', flexGrow: 1 }}>
          {weekDates.map(date => {
            const isToday = date.isSame(dayjs(), 'day');
            return (
              <Box
                key={date.format('YYYY-MM-DD')}
                sx={{
                  flex: 1, textAlign: 'center', py: 1.5,
                  borderRight: '1px solid', borderColor: 'divider',
                  '&:last-child': { borderRight: 'none' },
                  bgcolor: isToday ? 'rgba(99,102,241,0.08)' : 'transparent',
                }}
              >
                <Typography variant="caption" sx={{
                  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10,
                  color: isToday ? 'primary.light' : 'text.secondary', display: 'block',
                }}>
                  {date.format('ddd')}
                </Typography>
                <Typography variant="h6" sx={{
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? 'primary.light' : 'text.primary',
                  lineHeight: 1.3, fontSize: 18,
                }}>
                  {date.format('D')}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Scrollable body */}
      <Box ref={scrollRef} sx={{ display: 'flex', flexGrow: 1, overflowY: 'auto', position: 'relative' }}>
        {/* Time axis */}
        <Box sx={{
          width: 60, flexShrink: 0,
          borderRight: '1px solid', borderColor: 'divider',
          bgcolor: 'background.paper', position: 'relative',
        }}>
          {hours.map(h => (
            <Box key={h} sx={{ height: HOUR_HEIGHT, display: 'flex', justifyContent: 'flex-end', pr: 1 }}>
              {h > 0 && (
                <Typography sx={{ position: 'relative', top: -9, fontSize: 10, color: 'text.disabled', fontWeight: 500 }}>
                  {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        {/* Day columns */}
        <Box sx={{ flexGrow: 1, position: 'relative', display: 'flex' }}>
          {/* Horizontal hour lines (background) */}
          <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
            {hours.map(h => (
              <Box key={h} sx={{ height: HOUR_HEIGHT, borderBottom: '1px solid', borderColor: 'rgba(42,49,66,0.4)' }} />
            ))}
          </Box>

          {weekDates.map(date => {
            const dateStr = date.format('YYYY-MM-DD');
            const isToday = dateStr === todayStr;
            const dayEvents = eventsByDay.get(dateStr) || [];

            return (
              <Box
                key={dateStr}
                sx={{
                  flex: 1, position: 'relative',
                  borderRight: '1px solid', borderColor: 'divider',
                  '&:last-child': { borderRight: 'none' },
                  bgcolor: isToday ? 'rgba(99,102,241,0.04)' : 'transparent',
                }}
                onDragOver={e => { if (onEventDrop) e.preventDefault(); }}
                onDrop={e => {
                  if (!onEventDrop) return;
                  e.preventDefault();
                  const eventId = e.dataTransfer.getData('text/plain');
                  if (!eventId) return;
                  const offsetY = Number(e.dataTransfer.getData('application/offset-y')) || 0;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const snapped = Math.floor(Math.max(0, (e.clientY - offsetY) - rect.top) / 15) * 15;
                  const tgt = events.find(ev => ev.id === eventId);
                  if (!tgt) return;
                  const dur = tgt.end_at ? dayjs(tgt.end_at).diff(dayjs(tgt.start_at), 'minute') : 30;
                  const newStart = date.startOf('day').add(snapped, 'minute');
                  onEventDrop(eventId, newStart.toISOString(), newStart.add(dur, 'minute').toISOString());
                }}
              >
                {/* Today current-time line */}
                {isToday && (
                  <Box sx={{
                    position: 'absolute', left: 0, right: 0, top: `${nowMinutes}px`,
                    height: '2px', bgcolor: 'primary.main', zIndex: 5, pointerEvents: 'none',
                    '&::before': {
                      content: '""', position: 'absolute', left: -3, top: -4,
                      width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main',
                    },
                  }} />
                )}

                {dayEvents.map(evt => {
                  const start = dayjs(evt.start_at);
                  const top = start.hour() * 60 + start.minute();
                  const dur = evt.end_at ? Math.max(15, dayjs(evt.end_at).diff(start, 'minute')) : 30;
                  const { bg, fg, border, bar } = eventColors(evt.source === 'microactivity', evt.account_type === 'work');

                  return (
                    <Paper
                      key={evt.id}
                      onClick={e => { e.stopPropagation(); onEventClick(evt); }}
                      draggable={!!onEventDrop}
                      onDragStart={e => {
                        e.dataTransfer.setData('text/plain', evt.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('application/offset-y', String(e.clientY - e.currentTarget.getBoundingClientRect().top));
                      }}
                      elevation={0}
                      sx={{
                        position: 'absolute',
                        top: `${top}px`,
                        left: 2, right: 2,
                        height: `${dur}px`,
                        bgcolor: bg,
                        border: '1px solid', borderColor: border,
                        borderLeft: `3px solid ${bar}`,
                        borderRadius: '0 5px 5px 0',
                        px: 0.75, py: '3px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'filter 100ms ease, box-shadow 100ms ease, transform 80ms ease',
                        '&:hover': { filter: 'brightness(1.15)', boxShadow: `0 2px 10px ${border}`, zIndex: 10 },
                        zIndex: 1,
                      }}
                    >
                      <Typography sx={{ fontWeight: 600, fontSize: 11, lineHeight: 1.2, color: fg, display: 'flex', alignItems: 'center', gap: 0.4 }}>
                        {evt.source === 'microactivity' && <TaskAltIcon sx={{ fontSize: 11 }} />}
                        {evt.title}
                      </Typography>
                      {dur >= 30 && (
                        <Typography sx={{ fontSize: 10, opacity: 0.8, color: fg, display: 'block' }}>
                          {start.format('h:mm A')}
                        </Typography>
                      )}
                    </Paper>
                  );
                })}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
