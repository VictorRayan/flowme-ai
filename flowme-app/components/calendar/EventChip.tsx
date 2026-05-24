import { Box, Typography } from '@mui/material';
import { CalendarEvent } from './types';
import dayjs from 'dayjs';

interface EventChipProps {
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
  draggable?: boolean;
}

export default function EventChip({ event, onClick, draggable }: EventChipProps) {
  const isWork = event.account_type === 'work';

  // Color system — high contrast on dark bg
  let bg: string;
  let fg: string;
  let accentBar: string;
  let border: string;

  if (isWork) {
    bg = 'rgba(139,92,246,0.18)';
    fg = '#c4b5fd';
    accentBar = '#8b5cf6';
    border = 'rgba(139,92,246,0.35)';
  } else {
    // Personal / default — indigo
    bg = 'rgba(99,102,241,0.18)';
    fg = '#a5b4fc';
    accentBar = '#6366f1';
    border = 'rgba(99,102,241,0.35)';
  }

  const timeLabel = event.start_at ? dayjs(event.start_at).format('H:mm') : null;

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
        onClick?.(event);
      }}
      sx={{
        position: 'relative',
        bgcolor: bg,
        border: '1px solid',
        borderColor: border,
        borderRadius: '5px',
        px: 0.75,
        py: '3px',
        mb: '3px',
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        cursor: 'pointer',
        overflow: 'hidden',
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        transition: 'background-color 100ms ease, box-shadow 100ms ease, transform 80ms ease',
        '&:hover': {
          filter: 'brightness(1.15)',
          boxShadow: `0 2px 8px ${border}`,
          transform: 'translateY(-1px)',
        },
        '&:active': { transform: 'translateY(0)' },
        // Left accent bar
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '3px',
          bgcolor: accentBar,
          borderRadius: '5px 0 0 5px',
        },
        pl: '8px', // compensate for accent bar
      }}
    >
      {/* Time */}
      {timeLabel && (
        <Typography
          component="span"
          sx={{
            fontSize: 10,
            fontWeight: 600,
            color: fg,
            opacity: 0.75,
            flexShrink: 0,
            letterSpacing: '0.02em',
          }}
        >
          {timeLabel}
        </Typography>
      )}
      {/* Title */}
      <Typography
        noWrap
        sx={{
          fontSize: 12,
          fontWeight: 600,
          color: fg,
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
          flex: 1,
        }}
      >
        {event.title}
      </Typography>
    </Box>
  );
}
