import React from 'react';
import { Box, Drawer, Typography, IconButton, List, ListItem, Divider, Paper, useMediaQuery, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { CalendarEvent } from './types';
import dayjs from 'dayjs';
import VideocamIcon from '@mui/icons-material/Videocam';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditIcon from '@mui/icons-material/Edit';

interface DayDetailPanelProps {
  open: boolean;
  onClose: () => void;
  date: dayjs.Dayjs | null;
  events: CalendarEvent[];
  onEditEvent?: (event: CalendarEvent) => void;
}

export default function DayDetailPanel({ open, onClose, date, events, onEditEvent }: DayDetailPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const sortedEvents = [...events].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const content = (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight="bold">
          {date ? date.format('dddd, MMMM D') : 'Day Details'}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>
      <Divider sx={{ mb: 2 }} />
      
      <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
        {sortedEvents.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ mt: 4 }}>
            No events for this day.
          </Typography>
        ) : (
          <List disablePadding>
            {sortedEvents.map((evt) => {
              const start = dayjs(evt.start_at).format('h:mm A');
              const end = evt.end_at ? dayjs(evt.end_at).format('h:mm A') : '';
              const isMicro = evt.source === 'microactivity';

              return (
                <Paper key={evt.id} variant="outlined" sx={{ mb: 1.5, p: 1.5, borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {isMicro && <TaskAltIcon color="success" fontSize="small" />}
                      {evt.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      {start} {end && `- ${end}`}
                    </Typography>
                  </Box>
                  
                  {evt.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {evt.description}
                    </Typography>
                  )}

                  {evt.location && (
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 1 }}>
                      <LocationOnIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {evt.location}
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                    {evt.account_name && (
                      <Typography variant="caption" sx={{ bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 1 }}>
                        {evt.account_name} ({evt.account_type})
                      </Typography>
                    )}
                    {evt.meet_link && (
                      <Box component="a" href={evt.meet_link} target="_blank" rel="noopener noreferrer" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, textDecoration: 'none', color: 'primary.main', bgcolor: 'primary.50', px: 1, py: 0.5, borderRadius: 1 }}>
                        <VideocamIcon fontSize="small" />
                        <Typography variant="caption" fontWeight="bold">Join</Typography>
                      </Box>
                    )}
                    {evt.htmlLink && (
                      <Box component="a" href={evt.htmlLink} target="_blank" rel="noopener noreferrer" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, textDecoration: 'none', color: 'text.secondary', bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 1 }}>
                        <OpenInNewIcon fontSize="small" />
                        <Typography variant="caption" fontWeight="bold">Open on Calendar</Typography>
                      </Box>
                    )}
                    {onEditEvent && (
                      <Box 
                        onClick={() => onEditEvent(evt)} 
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'primary.main', bgcolor: 'primary.50', px: 1, py: 0.5, borderRadius: 1, cursor: 'pointer' }}
                      >
                        <EditIcon fontSize="small" />
                        <Typography variant="caption" fontWeight="bold">Edit</Typography>
                      </Box>
                    )}
                  </Box>
                </Paper>
              );
            })}
          </List>
        )}
      </Box>
    </Box>
  );

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 400 }, borderTopLeftRadius: { xs: 0, sm: 16 }, borderBottomLeftRadius: { xs: 0, sm: 16 } }
      }}
    >
      {content}
    </Drawer>
  );
}
