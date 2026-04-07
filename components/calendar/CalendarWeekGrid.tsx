import React, { useMemo, useRef, useEffect } from 'react';
import { Box, Typography, Paper, useTheme } from '@mui/material';
import dayjs from 'dayjs';
import { CalendarEvent } from './types';
import TaskAltIcon from '@mui/icons-material/TaskAlt';

interface CalendarWeekGridProps {
  currentDate: dayjs.Dayjs;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onEventDrop?: (eventId: string, newStart: string, newEnd?: string) => void;
}

const HOUR_HEIGHT = 60; // 1 pixel per minute

export default function CalendarWeekGrid({ currentDate, events, onEventClick, onEventDrop }: CalendarWeekGridProps) {
  const theme = useTheme();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to roughly 8 AM on initial render
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 8 * HOUR_HEIGHT;
    }
  }, []);

  // Generate the 7 days for the current week
  const weekDates = useMemo(() => {
    const startDate = currentDate.startOf('week');
    const dates = [];
    for (let i = 0; i < 7; i++) {
        dates.push(startDate.add(i, 'day'));
    }
    return dates;
  }, [currentDate]);

  // Group events by day string "YYYY-MM-DD"
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach(evt => {
      // Just mapping based on start_at for simplicity.
      // (Ignoring multi-day events that span midnight for this basic view)
      const dateKey = dayjs(evt.start_at).format('YYYY-MM-DD');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(evt);
    });
    return map;
  }, [events]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid', borderColor: 'grey.200', borderRadius: 1, overflow: 'hidden' }}>
      
      {/* Header Row (Days) */}
      <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'grey.200', bgcolor: 'grey.50' }}>
        <Box sx={{ width: 60, flexShrink: 0, borderRight: '1px solid', borderColor: 'grey.200' }} /> {/* Empty corner block */}
        <Box sx={{ display: 'flex', flexGrow: 1, position: 'relative' }}>
          {weekDates.map(date => {
            const isToday = date.isSame(dayjs(), 'day');
            return (
              <Box key={date.format('YYYY-MM-DD')} sx={{ flex: 1, textAlign: 'center', py: 1.5, borderRight: '1px solid', borderColor: 'grey.200' }}>
                <Typography variant="caption" color={isToday ? 'primary' : 'text.secondary'} fontWeight="bold" display="block" sx={{ textTransform: 'uppercase' }}>
                  {date.format('ddd')}
                </Typography>
                <Typography variant="h5" color={isToday ? 'primary' : 'text.primary'} fontWeight={isToday ? 'bold' : 'normal'}>
                  {date.format('D')}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Scrollable Timeline Body */}
      <Box ref={scrollContainerRef} sx={{ display: 'flex', flexGrow: 1, overflowY: 'auto', position: 'relative' }}>
        
        {/* Time Axis (Left column) */}
        <Box sx={{ width: 60, flexShrink: 0, position: 'relative', borderRight: '1px solid', borderColor: 'grey.200', bgcolor: 'background.paper' }}>
          {hours.map(hour => (
            <Box key={hour} sx={{ height: HOUR_HEIGHT, display: 'flex', justifyContent: 'flex-end', pr: 1, boxSizing: 'border-box' }}>
              {/* Offset slightly to align with the border line */}
              {hour > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ position: 'relative', top: -10, fontSize: '0.7rem' }}>
                  {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        {/* The Grid lines and Event Columns */}
        <Box sx={{ flexGrow: 1, position: 'relative', display: 'flex' }}>
          
          {/* Background Grid Lines (Horizontal) */}
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
             {hours.map(hour => (
               <Box key={hour} sx={{ height: HOUR_HEIGHT, borderBottom: '1px solid', borderColor: 'grey.100', boxSizing: 'border-box' }} />
             ))}
          </Box>

          {/* Columns (7 Days) */}
          {weekDates.map((date, colIndex) => {
            const dateStr = date.format('YYYY-MM-DD');
            const dayEvents = eventsByDay.get(dateStr) || [];
            
            return (
              <Box 
                key={dateStr} 
                sx={{ flex: 1, position: 'relative', borderRight: '1px solid', borderColor: 'grey.100' }}
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

                  const newStart = date.startOf('day').add(snappedMinutes, 'minute');
                  const newEnd = newStart.add(duration, 'minute');

                  onEventDrop(eventId, newStart.toISOString(), newEnd.toISOString());
                }}
              >
                {dayEvents.map(evt => {
                  const start = dayjs(evt.start_at);
                  const startMinutes = start.hour() * 60 + start.minute();
                  
                  // Calculate duration in minutes (default to 30 mins if microactivity has no end_at)
                  let durationMinutes = 30;
                  if (evt.end_at) {
                    const end = dayjs(evt.end_at);
                    durationMinutes = Math.max(15, end.diff(start, 'minute')); // Minimum 15m visually
                  }

                  const top = startMinutes;
                  const height = durationMinutes;
                  const isMicro = evt.source === 'microactivity';

                  // Basic color picking
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
                        
                        const clickOffset = e.clientY - e.currentTarget.getBoundingClientRect().top;
                        e.dataTransfer.setData('application/offset-y', clickOffset.toString());
                      }}
                      elevation={1}
                      sx={{
                        position: 'absolute',
                        top: `${top}px`,
                        left: '2px', // Slight margin from column border
                        right: '2px',
                        height: `${height}px`,
                        bgcolor: bgColor,
                        color: color,
                        p: 0.5,
                        borderRadius: 1,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'transform 0.1s, box-shadow 0.1s',
                        '&:hover': {
                          transform: 'scale(1.02)',
                          boxShadow: 3,
                          zIndex: 10
                        }
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5, lineHeight: 1.1 }}>
                        {isMicro && <TaskAltIcon sx={{ fontSize: '0.8rem' }} />}
                        {evt.title}
                      </Typography>
                      {height > 30 && (
                         <Typography variant="caption" sx={{ display: 'block', opacity: 0.8, fontSize: '0.65rem' }}>
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
