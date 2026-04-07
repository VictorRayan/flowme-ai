import React from 'react';
import { Box, Typography } from '@mui/material';
import { CalendarEvent } from './types';
import EventIcon from '@mui/icons-material/Event';
import TaskAltIcon from '@mui/icons-material/TaskAlt';

interface EventChipProps {
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
  draggable?: boolean;
}

export default function EventChip({ event, onClick, draggable }: EventChipProps) {
  const isMicro = event.source === 'microactivity';
  const isWork = event.account_type === 'work';

  // Determine colors based on type
  let bgcolor = 'primary.main';
  let color = 'primary.contrastText';
  let borderColor = 'transparent';

  if (isMicro) {
    bgcolor = 'transparent';
    color = 'text.primary';
    borderColor = 'grey.300';
  } else if (isWork) {
    bgcolor = 'secondary.main';
    color = 'secondary.contrastText';
  }

  return (
    <Box
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.setData('text/plain', event.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick(event);
      }}
      sx={{
        bgcolor,
        color,
        border: '1px solid',
        borderColor,
        borderRadius: 1,
        px: 0.5,
        py: 0.25,
        mb: 0.5,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        cursor: 'pointer',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        fontSize: '0.75rem',
        '&:hover': {
          opacity: 0.9,
        },
      }}
    >
      {isMicro ? (
        <TaskAltIcon sx={{ fontSize: '0.875rem', color: 'success.main' }} />
      ) : (
        <EventIcon sx={{ fontSize: '0.875rem' }} />
      )}
      <Typography variant="caption" noWrap sx={{ fontWeight: isMicro ? 'normal' : 'bold' }}>
        {event.title}
      </Typography>
    </Box>
  );
}
