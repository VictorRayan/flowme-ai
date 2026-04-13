'use client';

import * as React from 'react';
import { Box, Typography, Card, CardContent, Divider, Checkbox, IconButton, useTheme, useMediaQuery, Chip, alpha } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

// Dummy data for visual scaffolding
const MOCK_TASKS = {
  nonNegotiables: [
    { id: 1, title: 'Finalize Q3 Board Presentation', time: '10:00 AM', completed: false },
    { id: 2, title: 'Approve Marketing Budget', time: '1:00 PM', completed: true },
  ],
  negotiables: [
    { id: 3, title: 'Review Candidate Resumes', time: 'No specific time', completed: false },
    { id: 4, title: 'Catch up on Slack threads', time: 'End of day', completed: false },
  ],
  routines: [
    { id: 5, title: 'Drink 500ml Water', duration: '1m', icon: '💧', completed: true },
    { id: 6, title: 'Stretch / Stand up', duration: '15m', icon: '🧘', completed: false },
  ]
};

const FocusTaskCard = ({ title, time, completed, colorMain, colorLight }: any) => {
  return (
    <Card 
      elevation={0}
      sx={{ 
        mb: 2, 
        bgcolor: 'background.paper',
        borderRadius: 3,
        border: '1px solid',
        borderColor: completed ? 'divider' : alpha(colorMain, 0.2),
        transition: 'all 0.2s',
        opacity: completed ? 0.6 : 1,
        '&:hover': {
          borderColor: alpha(colorMain, 0.4),
          boxShadow: `0 4px 20px ${alpha(colorMain, 0.1)}`
        }
      }}
    >
      <CardContent sx={{ p: '16px !important', display: 'flex', alignItems: 'center', gap: 2 }}>
        <Checkbox 
          checked={completed} 
          sx={{ 
            color: alpha(colorMain, 0.5),
            '&.Mui-checked': { color: colorMain },
            '& .MuiSvgIcon-root': { fontSize: 28 } 
          }} 
        />
        <Box sx={{ flex: 1 }}>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              fontWeight: 600, 
              color: completed ? 'text.secondary' : 'text.primary',
              textDecoration: completed ? 'line-through' : 'none'
            }}
          >
            {title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, color: 'text.secondary' }}>
            <AccessTimeIcon sx={{ fontSize: 14 }} />
            <Typography variant="body2" sx={{ fontSize: 13 }}>{time}</Typography>
          </Box>
        </Box>
        {/* Action Button */}
        {!completed && (
          <IconButton size="small" sx={{ color: colorMain, bgcolor: alpha(colorMain, 0.1) }}>
            <PlayArrowIcon fontSize="small" />
          </IconButton>
        )}
      </CardContent>
    </Card>
  );
};

export default function FlowDashboard() {
  const theme = useTheme();
  // We use standard MUI layout (Box/Stack) which is inherently flexbox and mobile-responsive.

  return (
    <Box sx={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: '#0a0a0d', // Extremely dark sleek background
      minHeight: '100%',
      p: { xs: 2, sm: 4, md: 6 } // Scales padding for mobile
    }}>
      
      {/* Header section */}
      <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-1px', color: '#fff', mb: 1 }}>
            Focus mode.
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Your curated daily priorities based on your SMART goals.
          </Typography>
        </Box>
        
        {/* Rhythm / Streak indicator */}
        <Chip 
          label="🔥 4 Day Rhythm" 
          sx={{ 
            bgcolor: alpha(theme.palette.warning.main, 0.1), 
            color: theme.palette.warning.light,
            fontWeight: 600,
            borderRadius: 2
          }} 
        />
      </Box>

      {/* Main Grid: Responsive column wrapping */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', lg: 'row' }, 
        gap: { xs: 4, lg: 6 },
        alignItems: 'flex-start'
      }}>
        
        {/* Left Column: Core Focus (Takes most space on Desktop) */}
        <Box sx={{ flex: { xs: '1 1 auto', lg: '8' }, width: '100%' }}>
          
          {/* NON-NEGOTIABLES */}
          <Box sx={{ mb: 5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ef4444', boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)' }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>
                Non-Negotiables
              </Typography>
            </Box>
            {MOCK_TASKS.nonNegotiables.map(task => (
              <FocusTaskCard key={task.id} {...task} colorMain="#ef4444" colorLight="#fecaca" />
            ))}
          </Box>

          <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.05)' }} />

          {/* NEGOTIABLES */}
          <Box sx={{ mb: 5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#94a3b8' }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#cbd5e1' }}>
                Negotiables
              </Typography>
            </Box>
            {MOCK_TASKS.negotiables.map(task => (
              <FocusTaskCard key={task.id} {...task} colorMain="#94a3b8" colorLight="#e2e8f0" />
            ))}
          </Box>

        </Box>

        {/* Right Column: Routines & Micro-tasks (Sidebar-ish on Desktop) */}
        <Box sx={{ 
          flex: { xs: '1 1 auto', lg: '4' }, 
          width: '100%',
          bgcolor: 'rgba(255,255,255,0.02)',
          borderRadius: 4,
          p: { xs: 3, md: 4 },
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 3, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '1px', fontSize: 12 }}>
            Micro-Routines
          </Typography>
          
          {MOCK_TASKS.routines.map(task => (
             <Box key={task.id} sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              py: 2,
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              opacity: task.completed ? 0.5 : 1
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography sx={{ fontSize: 24 }}>{task.icon}</Typography>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>{task.title}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{task.duration}</Typography>
                </Box>
              </Box>
              <Checkbox 
                checked={task.completed} 
                size="small"
                sx={{ '&.Mui-checked': { color: '#60a5fa' } }} 
              />
            </Box>
          ))}
          
          <Box sx={{ mt: 5 }}>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
              "Clarity comes from focus. Ignore the noise." — Balys AI
            </Typography>
          </Box>
        </Box>

      </Box>
    </Box>
  );
}
