import React, { useMemo, useRef, useEffect } from 'react';
import { Box, Typography, Paper, useTheme } from '@mui/material';
import dayjs from 'dayjs';
import { CalendarEvent } from './types';
import TaskAltIcon from '@mui/icons-material/TaskAlt';

interface CalendarDayGridProps {
  currentDate: dayjs.Dayjs;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onEventDrop?: (eventId: string, newStart: string, newEnd?: string) => void;
}

const HOUR_HEIGHT = 60; // 1 pixel per minute

export default function CalendarDayGrid({ currentDate, events, onEventClick, onEventDrop }: CalendarDayGridProps) {
  const theme = useTheme();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 8 * HOUR_HEIGHT;
    }
  }, []);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const isToday = currentDate.isSame(dayjs(), 'day');

  // Filter events only for this day natively, just in case
  const dayEvents = useMemo(() => {
    return events.filter(evt => dayjs(evt.start_at).isSame(currentDate, 'day'));
  }, [events, currentDate]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid', borderColor: 'grey.200', borderRadius: 1, overflow: 'hidden' }}>
      
      {/* Header Row */}
      <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'grey.200', bgcolor: 'grey.50' }}>
        <Box sx={{ width: 60, flexShrink: 0, borderRight: '1px solid', borderColor: 'grey.200' }} />
        <Box sx={{ flex: 1, textAlign: 'center', py: 1.5 }}>
          <Typography variant="caption" color={isToday ? 'primary' : 'text.secondary'} fontWeight="bold" display="block" sx={{ textTransform: 'uppercase' }}>
            {currentDate.format('dddd')}
          </Typography>
          <Typography variant="h4" color={isToday ? 'primary' : 'text.primary'} fontWeight={isToday ? 'bold' : 'normal'}>
            {currentDate.format('D')}
          </Typography>
        </Box>
      </Box>

      {/* Scrollable Timeline Body */}
      <Box ref={scrollContainerRef} sx={{ display: 'flex', flexGrow: 1, overflowY: 'auto', position: 'relative' }}>
        
        {/* Time Axis */}
        <Box sx={{ width: 60, flexShrink: 0, position: 'relative', borderRight: '1px solid', borderColor: 'grey.200', bgcolor: 'background.paper' }}>
          {hours.map(hour => (
            <Box key={hour} sx={{ height: HOUR_HEIGHT, display: 'flex', justifyContent: 'flex-end', pr: 1, boxSizing: 'border-box' }}>
              {hour > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ position: 'relative', top: -10, fontSize: '0.7rem' }}>
                  {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        {/* The Grid lines and Event Column */}
        <Box 
          sx={{ flexGrow: 1, position: 'relative', borderRight: '1px solid', borderColor: 'grey.100' }}
          onDragOver={(e) => {
            if (onEventDrop) e.preventDefault();
          }}
          onDrop={(e) => {
            if (!onEventDrop) return;
            e.preventDefault();
            const eventId = e.dataTransfer.getData('text/plain');
            if (!eventId) return;

            const dragOffsetY = Number(e.dataTransfer.getData('application/offset-y')) || 0;
            const rect = e.currentTarget.getBoundingClientRect();
            const dropY = (e.clientY - dragOffsetY) - rect.top;
            
            // 1 minute per pixel, snap to 15 mins
            const minutesFromMidnight = Math.max(0, dropY);
            const snappedMinutes = Math.floor(minutesFromMidnight / 15) * 15;
            
            const targetEvent = events.find(ev => ev.id === eventId);
            if (!targetEvent) return;

            const oldStart = dayjs(targetEvent.start_at);
            const duration = targetEvent.end_at ? dayjs(targetEvent.end_at).diff(oldStart, 'minute') : 30;

            const newStart = currentDate.startOf('day').add(snappedMinutes, 'minute');
            const newEnd = newStart.add(duration, 'minute');

            onEventDrop(eventId, newStart.toISOString(), newEnd.toISOString());
          }}
        >
          
          {/* Background Grid Lines */}
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
             {hours.map(hour => (
               <Box key={hour} sx={{ height: HOUR_HEIGHT, borderBottom: '1px solid', borderColor: 'grey.100', boxSizing: 'border-box' }} />
             ))}
          </Box>

          {/* Events */}
          {dayEvents.map(evt => {
            const start = dayjs(evt.start_at);
            const startMinutes = start.hour() * 60 + start.minute();
            
            let durationMinutes = 30;
            if (evt.end_at) {
              const end = dayjs(evt.end_at);
              durationMinutes = Math.max(15, end.diff(start, 'minute'));
            }

            const top = startMinutes;
            const height = durationMinutes;
            const isMicro = evt.source === 'microactivity';

            const bgColor = isMicro ? theme.palette.success.light : theme.palette.primary.light;
            const color = isMicro ? theme.palette.success.contrastText : theme.palette.primary.contrastText;

            return (
              <Paper
                key={evt.id}
                onClick={(e) => { e.stopPropagation(); onEventClick(evt); }}
                draggable={!!onEventDrop}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', evt.id);
                  e.dataTransfer.effectAllowed = 'move';
                  
                  // Record how far down the mouse clicked inside the event chip
                  const clickOffset = e.clientY - e.currentTarget.getBoundingClientRect().top;
                  e.dataTransfer.setData('application/offset-y', clickOffset.toString());
                }}
                elevation={1}
                sx={{
                  position: 'absolute',
                  top: `${top}px`,
                  left: '10px',
                  right: '10px',
                  height: `${height}px`,
                  bgcolor: bgColor,
                  color: color,
                  p: 1,
                  borderRadius: 1,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                  '&:hover': {
                    transform: 'scale(1.01)',
                    boxShadow: 3,
                    zIndex: 10
                  }
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {isMicro && <TaskAltIcon fontSize="small" />}
                  {evt.title}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
                  {start.format('h:mm A')} {evt.end_at ? `- ${dayjs(evt.end_at).format('h:mm A')}` : ''}
                </Typography>
              </Paper>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
