import { Box, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { CalendarEvent } from './types';
import EventChip from './EventChip';

interface DayCellProps {
  date: number;
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
      onDragOver={(e) => { if (onEventDrop) e.preventDefault(); }}
      onDrop={(e) => {
        if (!onEventDrop) return;
        e.preventDefault();
        e.stopPropagation();
        const eventId = e.dataTransfer.getData('text/plain');
        if (eventId) onEventDrop(eventId, fullDate.format('YYYY-MM-DD'));
      }}
      sx={{
        borderRight: '1px solid',
        borderBottom: '1px solid',
        borderColor: 'divider',
        p: 0.75,
        minHeight: { xs: 80, md: 120 },
        // Off-month cells are visually recessed
        bgcolor: isCurrentMonth ? 'background.paper' : 'rgba(13,15,20,0.6)',
        cursor: 'pointer',
        transition: 'background-color 120ms ease',
        display: 'flex',
        flexDirection: 'column',
        '&:last-child': { borderRight: 'none' },
        '&:hover': {
          bgcolor: isCurrentMonth ? 'rgba(99,102,241,0.07)' : 'rgba(99,102,241,0.04)',
        },
      }}
    >
      {/* Date number */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
        <Typography
          variant="body2"
          sx={{
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            fontSize: 13,
            fontWeight: isToday ? 700 : isCurrentMonth ? 500 : 400,
            // Today: indigo filled circle with glow
            bgcolor: isToday ? 'primary.main' : 'transparent',
            color: isToday
              ? '#fff'
              : isCurrentMonth
              ? 'text.primary'
              : 'text.disabled',
            boxShadow: isToday ? '0 0 10px rgba(99,102,241,0.55)' : 'none',
            transition: 'box-shadow 200ms ease',
          }}
        >
          {date}
        </Typography>
      </Box>

      {/* Events */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {eventsToShow.map((evt) => (
          <EventChip key={evt.id} event={evt} onClick={onEventClick} draggable={!!onEventDrop} />
        ))}
        {overflowCount > 0 && (
          <Typography
            variant="caption"
            sx={{
              pl: 0.5,
              fontWeight: 600,
              fontSize: 11,
              color: 'primary.light',
              letterSpacing: '0.02em',
            }}
          >
            +{overflowCount} more
          </Typography>
        )}
      </Box>
    </Box>
  );
}
