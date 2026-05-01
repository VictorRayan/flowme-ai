import { useMemo, useRef, useEffect } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import dayjs from 'dayjs';
import { CalendarEvent } from './types';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { buildDroppedEventRange, DAY_MINUTES, dropYToMinuteOfDay, eventDurationMinutes, HOUR_HEIGHT, minutesFromDayStart } from '@/lib/calendar/time-grid';

interface CalendarDayGridProps {
  currentDate: dayjs.Dayjs;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onEventDrop?: (eventId: string, newStart: string, newEnd?: string) => void;
}

// Shared color helper — same logic as EventChip for consistency
function eventColors(isMicro: boolean, isWork: boolean) {
  if (isMicro)  return { bg: 'rgba(52,211,153,0.18)',  fg: '#6ee7b7', border: 'rgba(52,211,153,0.35)',  bar: '#34d399' };
  if (isWork)   return { bg: 'rgba(139,92,246,0.18)',  fg: '#c4b5fd', border: 'rgba(139,92,246,0.35)',  bar: '#8b5cf6' };
  return          { bg: 'rgba(99,102,241,0.18)',        fg: '#a5b4fc', border: 'rgba(99,102,241,0.35)',  bar: '#6366f1' };
}

export default function CalendarDayGrid({ currentDate, events, onEventClick, onEventDrop }: CalendarDayGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_HEIGHT;
  }, []);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const isToday = currentDate.isSame(dayjs(), 'day');

  const dayEvents = useMemo(() =>
    events.filter(evt => dayjs(evt.start_at).isSame(currentDate, 'day')),
    [events, currentDate]
  );

  // Current time indicator position
  const nowMinutes = dayjs().hour() * 60 + dayjs().minute();
  const timelineHeight = DAY_MINUTES / 60 * HOUR_HEIGHT;

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', height: '100%',
      border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden',
      bgcolor: 'background.paper',
    }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: 'rgba(99,102,241,0.06)',
      }}>
        <Box sx={{ width: 60, flexShrink: 0, borderRight: '1px solid', borderColor: 'divider' }} />
        <Box sx={{ flex: 1, textAlign: 'center', py: 2 }}>
          <Typography variant="caption" sx={{
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11,
            color: isToday ? 'primary.light' : 'text.secondary', display: 'block',
          }}>
            {currentDate.format('dddd')}
          </Typography>
          <Typography variant="h4" sx={{
            fontWeight: isToday ? 700 : 400,
            color: isToday ? 'primary.light' : 'text.primary',
            lineHeight: 1.2,
          }}>
            {currentDate.format('D')}
          </Typography>
        </Box>
      </Box>

      {/* Scrollable timeline */}
      <Box ref={scrollRef} sx={{ display: 'flex', flexGrow: 1, overflowY: 'auto', position: 'relative' }}>
        {/* Time axis */}
        <Box sx={{
          width: 60, flexShrink: 0, position: 'relative',
          borderRight: '1px solid', borderColor: 'divider',
          bgcolor: 'background.paper',
          minHeight: timelineHeight,
        }}>
          {hours.map(h => (
            <Box key={h} sx={{ height: HOUR_HEIGHT, display: 'flex', justifyContent: 'flex-end', pr: 1 }}>
              {h > 0 && (
                <Typography variant="caption" sx={{ position: 'relative', top: -9, fontSize: 10, color: 'text.disabled', fontWeight: 500 }}>
                  {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        {/* Grid + events */}
        <Box
          sx={{ flexGrow: 1, position: 'relative', minHeight: timelineHeight }}
          onDragOver={e => { if (onEventDrop) e.preventDefault(); }}
          onDrop={e => {
            if (!onEventDrop) return;
            e.preventDefault();
            const eventId = e.dataTransfer.getData('text/plain');
            if (!eventId) return;
            const offsetY = Number(e.dataTransfer.getData('application/offset-y')) || 0;
            const rect = e.currentTarget.getBoundingClientRect();
            const dropY = (e.clientY - offsetY) - rect.top;
            const tgt = events.find(ev => ev.id === eventId);
            if (!tgt) return;
            const minuteOfDay = dropYToMinuteOfDay(dropY);
            const duration = eventDurationMinutes(tgt.start_at, tgt.end_at);
            const range = buildDroppedEventRange(currentDate, minuteOfDay, duration);
            onEventDrop(eventId, range.start, range.end);
          }}
        >
          {/* Hour lines — use background-image for reliable rendering */}
          {hours.map(h => (
            <Box
              key={h}
              sx={{
                position: 'absolute',
                pointerEvents: 'none',
                left: 0,
                right: 0,
                top: h * HOUR_HEIGHT,
                height: HOUR_HEIGHT,
                borderTop: '1px solid rgba(42,49,66,0.65)',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: HOUR_HEIGHT / 2,
                  borderTop: '1px dashed rgba(42,49,66,0.28)',
                },
              }}
            />
          ))}

          {/* Current time line */}
          {isToday && (
            <Box sx={{
              position: 'absolute', left: 0, right: 0,
              top: `${nowMinutes / 60 * HOUR_HEIGHT}px`,
              height: '2px',
              bgcolor: 'primary.main',
              zIndex: 5,
              pointerEvents: 'none',
              '&::before': {
                content: '""', position: 'absolute', left: -4, top: -4,
                width: 10, height: 10, borderRadius: '50%', bgcolor: 'primary.main',
              },
            }} />
          )}

          {/* Events */}
          {dayEvents.map(evt => {
            const start = dayjs(evt.start_at);
            const top = minutesFromDayStart(evt.start_at);
            const dur = eventDurationMinutes(evt.start_at, evt.end_at);
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
                  top: `${top / 60 * HOUR_HEIGHT}px`,
                  left: 8, right: 8,
                  height: `${dur / 60 * HOUR_HEIGHT}px`,
                  bgcolor: bg,
                  color: fg,
                  border: '1px solid',
                  borderColor: border,
                  borderLeft: `3px solid ${bar}`,
                  borderRadius: '0 6px 6px 0',
                  px: 1, py: 0.5,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'filter 100ms ease, box-shadow 100ms ease, transform 80ms ease',
                  '&:hover': { filter: 'brightness(1.15)', boxShadow: `0 2px 12px ${border}`, transform: 'translateX(1px)', zIndex: 10 },
                }}
              >
                <Typography sx={{ fontWeight: 600, fontSize: 13, lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 0.5, color: fg }}>
                  {evt.source === 'microactivity' && <TaskAltIcon sx={{ fontSize: 13 }} />}
                  {evt.title}
                </Typography>
                {dur >= 25 && (
                  <Typography sx={{ display: 'block', fontSize: 11, opacity: 0.8, mt: 0.25, color: fg }}>
                    {start.format('h:mm A')}{evt.end_at ? ` – ${dayjs(evt.end_at).format('h:mm A')}` : ''}
                  </Typography>
                )}
              </Paper>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
