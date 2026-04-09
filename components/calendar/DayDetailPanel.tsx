import { Box, Drawer, Typography, IconButton, List, Divider, Paper, useMediaQuery, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { CalendarEvent } from './types';
import dayjs from 'dayjs';
import VideocamIcon from '@mui/icons-material/Videocam';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditIcon from '@mui/icons-material/Edit';
import EventIcon from '@mui/icons-material/Event';

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

  const sorted = [...events].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const content = (
    <Box sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Box>
          <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.1em', fontSize: 10 }}>
            {date?.format('MMMM YYYY')}
          </Typography>
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            {date ? date.format('dddd, D') : 'Day Details'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Divider sx={{ mb: 2 }} />

      {/* Event list */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
        {sorted.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 6, gap: 1.5, opacity: 0.5 }}>
            <EventIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
            <Typography color="text.secondary" variant="body2">No events for this day</Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {sorted.map(evt => {
              const start = dayjs(evt.start_at).format('h:mm A');
              const end = evt.end_at ? dayjs(evt.end_at).format('h:mm A') : '';
              const isMicro = evt.source === 'microactivity';
              const isWork = evt.account_type === 'work';

              // Accent color per type
              const accent = isMicro ? '#34d399' : isWork ? '#8b5cf6' : '#6366f1';
              const accentBg = isMicro ? 'rgba(52,211,153,0.1)' : isWork ? 'rgba(139,92,246,0.1)' : 'rgba(99,102,241,0.1)';
              const accentBorder = isMicro ? 'rgba(52,211,153,0.25)' : isWork ? 'rgba(139,92,246,0.25)' : 'rgba(99,102,241,0.25)';

              return (
                <Paper
                  key={evt.id}
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: '#1e2433',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: `3px solid ${accent}`,
                    transition: 'box-shadow 120ms ease',
                    '&:hover': { boxShadow: `0 0 0 1px ${accentBorder}` },
                  }}
                >
                  {/* Title row */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.primary' }}>
                      {isMicro && <TaskAltIcon sx={{ fontSize: 15, color: '#34d399' }} />}
                      {evt.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, flexShrink: 0, ml: 1, fontSize: 11 }}>
                      {start}{end && ` – ${end}`}
                    </Typography>
                  </Box>

                  {evt.description && (
                    <Typography variant="body2" sx={{
                      color: 'text.secondary', mb: 1, fontSize: 12,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {evt.description}
                    </Typography>
                  )}

                  {evt.location && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                      <LocationOnIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{evt.location}</Typography>
                    </Box>
                  )}

                  {/* Action badges */}
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                    {evt.account_name && (
                      <Box sx={{ px: 1, py: '3px', borderRadius: 1, bgcolor: '#161b27', border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                          {evt.account_name} · {evt.account_type}
                        </Typography>
                      </Box>
                    )}
                    {evt.meet_link && (
                      <Box
                        component="a" href={evt.meet_link} target="_blank" rel="noopener noreferrer"
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 0.5,
                          px: 1, py: '3px', borderRadius: 1,
                          bgcolor: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)',
                          textDecoration: 'none',
                          transition: 'background-color 100ms',
                          '&:hover': { bgcolor: 'rgba(52,211,153,0.18)' },
                        }}
                      >
                        <VideocamIcon sx={{ fontSize: 13, color: '#34d399' }} />
                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#34d399', fontSize: 11 }}>Join</Typography>
                      </Box>
                    )}
                    {evt.htmlLink && (
                      <Box
                        component="a" href={evt.htmlLink} target="_blank" rel="noopener noreferrer"
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 0.5,
                          px: 1, py: '3px', borderRadius: 1,
                          bgcolor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                          textDecoration: 'none',
                          transition: 'background-color 100ms',
                          '&:hover': { bgcolor: 'rgba(99,102,241,0.18)' },
                        }}
                      >
                        <OpenInNewIcon sx={{ fontSize: 13, color: '#818cf8' }} />
                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#818cf8', fontSize: 11 }}>Open</Typography>
                      </Box>
                    )}
                    {onEditEvent && (
                      <Box
                        onClick={() => onEditEvent(evt)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 0.5,
                          px: 1, py: '3px', borderRadius: 1,
                          bgcolor: accentBg, border: `1px solid ${accentBorder}`,
                          cursor: 'pointer',
                          transition: 'background-color 100ms',
                          '&:hover': { filter: 'brightness(1.2)' },
                        }}
                      >
                        <EditIcon sx={{ fontSize: 13, color: accent }} />
                        <Typography variant="caption" sx={{ fontWeight: 600, color: accent, fontSize: 11 }}>Edit</Typography>
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
      anchor={isMobile ? 'bottom' : 'right'}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 400,
          maxHeight: isMobile ? '80vh' : '100%',
          borderTopLeftRadius: isMobile ? 16 : 0,
          borderTopRightRadius: isMobile ? 16 : 0,
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          borderLeft: isMobile ? 'none' : '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      {content}
    </Drawer>
  );
}
