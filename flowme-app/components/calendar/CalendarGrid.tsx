import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import dayjs from 'dayjs';
import DayCell from './DayCell';
import { CalendarEvent } from './types';

interface CalendarGridProps {
  currentDate: dayjs.Dayjs;
  events: CalendarEvent[];
  onDayClick: (date: dayjs.Dayjs, events: CalendarEvent[]) => void;
  onEventClick?: (evt: CalendarEvent) => void;
  onEventDrop?: (eventId: string, newStart: string, newEnd?: string) => void;
}

export default function CalendarGrid({ currentDate, events, onDayClick, onEventClick, onEventDrop }: CalendarGridProps) {
  const gridDates = useMemo(() => {
    const startDate = currentDate.startOf('month').startOf('week');
    const endDate = currentDate.endOf('month').endOf('week');
    const dates = [];
    let current = startDate;
    while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
      dates.push(current);
      current = current.add(1, 'day');
    }
    return dates;
  }, [currentDate]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach(evt => {
      const key = dayjs(evt.start_at).format('YYYY-MM-DD');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(evt);
    });
    return map;
  }, [events]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Box sx={{
      width: '100%',
      borderRadius: 2,
      overflow: 'hidden',
      border: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.paper',
    }}>
      {/* Day-of-week header */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', bgcolor: 'rgba(99,102,241,0.06)', borderBottom: '1px solid', borderColor: 'divider' }}>
        {weekDays.map((day) => (
          <Box
            key={day}
            sx={{
              py: 1.25,
              textAlign: 'center',
              borderRight: '1px solid',
              borderColor: 'divider',
              '&:last-child': { borderRight: 'none' },
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary', fontSize: 11 }}
            >
              {day}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Grid cells */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {gridDates.map((date) => {
          const dateStr = date.format('YYYY-MM-DD');
          const dayEvents = eventsByDate.get(dateStr) || [];
          return (
            <DayCell
              key={dateStr}
              date={date.date()}
              fullDate={date}
              isCurrentMonth={date.month() === currentDate.month()}
              isToday={date.isSame(dayjs(), 'day')}
              events={dayEvents}
              onClick={() => onDayClick(date, dayEvents)}
              onEventClick={onEventClick}
              onEventDrop={onEventDrop}
            />
          );
        })}
      </Box>
    </Box>
  );
}
