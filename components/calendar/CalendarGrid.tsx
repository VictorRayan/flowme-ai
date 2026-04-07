import React, { useMemo } from 'react';
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
  // Generate the calendar grid dates
  const gridDates = useMemo(() => {
    const startOfMonth = currentDate.startOf('month');
    const endOfMonth = currentDate.endOf('month');
    
    const startDate = startOfMonth.startOf('week'); // Sunday
    const endDate = endOfMonth.endOf('week'); // Saturday

    const dates = [];
    let current = startDate;

    while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
      dates.push(current);
      current = current.add(1, 'day');
    }

    return dates;
  }, [currentDate]);

  // Group events by YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    
    events.forEach(evt => {
      const dateKey = dayjs(evt.start_at).format('YYYY-MM-DD');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(evt);
    });

    return map;
  }, [events]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Box sx={{ width: '100%', borderTop: '1px solid', borderLeft: '1px solid', borderColor: 'grey.200' }}>
      {/* Header Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', bgcolor: 'grey.50' }}>
        {weekDays.map((day) => (
          <Box key={day} sx={{ p: 1, borderRight: '1px solid', borderBottom: '1px solid', borderColor: 'grey.200', textAlign: 'center' }}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight="bold">
              {day}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Grid Cells */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {gridDates.map((date, i) => {
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
