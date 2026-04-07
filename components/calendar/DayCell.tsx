import React from 'react';
import { Box, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { CalendarEvent } from './types';
import EventChip from './EventChip';

interface DayCellProps {
  date: number; // The day of the month
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  fullDate: dayjs.Dayjs;
  onClick: () => void;
  onEventClick?: (evt: CalendarEvent) => void;
  onEventDrop?: (eventId: string, newStart: string, newEnd?: string) => void;
}

export default function DayCell({ date, isCurrentMonth, isToday, events, fullDate, onClick, onEventClick, onEventDrop }: DayCellProps) {
  const maxEventsToShow = 3;
  const eventsToShow = events.slice(0, maxEventsToShow);
  const overflowCount = events.length > maxEventsToShow ? events.length - maxEventsToShow : 0;

  return (
    <Box
      onClick={onClick}
      onDragOver={(e) => {
        if (onEventDrop) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!onEventDrop) return;
        e.preventDefault();
        e.stopPropagation();
        const eventId = e.dataTransfer.getData('text/plain');
        if (!eventId) return;

        // In month view, we only shift the date. The time will be preserved by the parent.
        onEventDrop(eventId, fullDate.format('YYYY-MM-DD'));
      }}
      sx={{
        borderRight: '1px solid',
        borderBottom: '1px solid',
        borderColor: 'grey.200',
        p: 0.5,
        minHeight: { xs: 80, md: 120 },
        bgcolor: isCurrentMonth ? 'background.paper' : 'grey.50',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        display: 'flex',
        flexDirection: 'column',
        '&:hover': {
          bgcolor: 'grey.100',
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
        <Typography
          variant="body2"
          sx={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            bgcolor: isToday ? 'primary.main' : 'transparent',
            color: isToday ? 'primary.contrastText' : isCurrentMonth ? 'text.primary' : 'text.disabled',
            fontWeight: isToday ? 'bold' : 'normal',
          }}
        >
          {date}
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {eventsToShow.map((evt) => (
          <EventChip key={evt.id} event={evt} onClick={onEventClick} draggable={!!onEventDrop} />
        ))}
        {overflowCount > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5, fontWeight: 'bold' }}>
            +{overflowCount} more
          </Typography>
        )}
      </Box>
    </Box>
  );
}
