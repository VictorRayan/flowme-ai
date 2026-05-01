'use client';

import * as React from 'react';
import { Box, Typography, Card, CardContent, Divider, Checkbox, CircularProgress, Alert, Chip, alpha, Button } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import Link from 'next/link';
import { useTheme } from '@mui/material/styles';

type TaskStatus = 'pending' | 'completed' | 'skipped';
type TaskCategory = 'non_negotiable' | 'negotiable' | 'routine';

interface Task {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: number;
  scheduled_date: string;
  start_at: string;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const FocusTaskCard = ({ task, colorMain, onToggle }: { task: Task; colorMain: string; onToggle: () => void }) => {
  const done = task.status === 'completed';
  const time = task.start_at
    ? new Date(task.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <Card
      elevation={0}
      sx={{
        mb: 2,
        bgcolor: 'background.paper',
        borderRadius: 3,
        border: '1px solid',
        borderColor: done ? 'divider' : alpha(colorMain, 0.2),
        transition: 'all 0.2s',
        opacity: done ? 0.6 : 1,
        '&:hover': {
          borderColor: alpha(colorMain, 0.4),
          boxShadow: `0 4px 20px ${alpha(colorMain, 0.1)}`,
        },
      }}
    >
      <CardContent sx={{ p: '16px !important', display: 'flex', alignItems: 'center', gap: 2 }}>
        <Checkbox
          checked={done}
          onChange={onToggle}
          sx={{
            color: alpha(colorMain, 0.5),
            '&.Mui-checked': { color: colorMain },
            '& .MuiSvgIcon-root': { fontSize: 26 },
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            noWrap
            sx={{
              fontWeight: 600,
              color: done ? 'text.secondary' : 'text.primary',
              textDecoration: done ? 'line-through' : 'none',
            }}
          >
            {task.title}
          </Typography>
          {time && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, color: 'text.secondary' }}>
              <AccessTimeIcon sx={{ fontSize: 14 }} />
              <Typography variant="body2" sx={{ fontSize: 13 }}>{time}</Typography>
            </Box>
          )}
        </Box>
        {!done && (
          <Box sx={{ color: colorMain, bgcolor: alpha(colorMain, 0.1), borderRadius: '50%', p: 0.75, display: 'flex' }}>
            <PlayArrowIcon fontSize="small" />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default function FlowDashboard() {
  const theme = useTheme();
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchToday = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tasks?date=${todayISO()}&limit=100`);
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to load tasks');
        setTasks(data.tasks);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchToday();
  }, []);

  const handleToggle = async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    }
  };

  const nonNeg = tasks.filter(t => t.category === 'non_negotiable');
  const negotiable = tasks.filter(t => t.category === 'negotiable');
  const routines = tasks.filter(t => t.category === 'routine');

  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'completed').length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#0a0a0d',
        minHeight: '100%',
        p: { xs: 2, sm: 4, md: 6 },
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-1px', color: '#fff', mb: 1 }}>
            {formatGreeting()}.
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            {loading ? 'Loading your day…' : total === 0
              ? 'No tasks for today. Add some below.'
              : `${done} of ${total} tasks done · ${progress}% complete`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          {!loading && total > 0 && (
            <Chip
              label={`${progress}% done`}
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.15),
                color: theme.palette.primary.light,
                fontWeight: 600,
                borderRadius: 2,
              }}
            />
          )}
          <Button
            component={Link}
            href="/app/tasks"
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary', borderColor: 'divider' }}
          >
            Cowork with Balys
          </Button>
        </Box>
      </Box>

      {/* Progress bar */}
      {!loading && total > 0 && (
        <Box sx={{ mb: 5, height: 3, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${progress}%`, bgcolor: 'primary.main', borderRadius: 2, transition: 'width 0.4s ease' }} />
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress sx={{ color: 'primary.main' }} />
        </Box>
      ) : total === 0 ? (
        <Box sx={{ textAlign: 'center', py: 12 }}>
          <Typography variant="h6" sx={{ color: 'text.secondary', mb: 2 }}>No tasks scheduled for today</Typography>
          <Button component={Link} href="/app/tasks" variant="contained" startIcon={<AddIcon />} sx={{ borderRadius: 2, textTransform: 'none' }}>
            Start Cowork with Balys
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: { xs: 4, lg: 6 }, alignItems: 'flex-start' }}>
          {/* Left: Non-negotiables + Negotiables */}
          <Box sx={{ flex: { xs: '1 1 auto', lg: '8' }, width: '100%' }}>
            {nonNeg.length > 0 && (
              <Box sx={{ mb: 5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ef4444', boxShadow: '0 0 10px rgba(239,68,68,0.5)' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>Non-Negotiables</Typography>
                  <Chip label={`${nonNeg.filter(t => t.status === 'completed').length}/${nonNeg.length}`} size="small" sx={{ ml: 1, height: 20, fontSize: 11, bgcolor: 'rgba(239,68,68,0.12)', color: '#ef4444' }} />
                </Box>
                {nonNeg.map(task => (
                  <FocusTaskCard key={task.id} task={task} colorMain="#ef4444" onToggle={() => handleToggle(task)} />
                ))}
              </Box>
            )}

            {negotiable.length > 0 && (
              <>
                {nonNeg.length > 0 && <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.05)' }} />}
                <Box sx={{ mb: 5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#94a3b8' }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#cbd5e1' }}>Negotiables</Typography>
                    <Chip label={`${negotiable.filter(t => t.status === 'completed').length}/${negotiable.length}`} size="small" sx={{ ml: 1, height: 20, fontSize: 11 }} />
                  </Box>
                  {negotiable.map(task => (
                    <FocusTaskCard key={task.id} task={task} colorMain="#94a3b8" onToggle={() => handleToggle(task)} />
                  ))}
                </Box>
              </>
            )}
          </Box>

          {/* Right: Routines */}
          {routines.length > 0 && (
            <Box
              sx={{
                flex: { xs: '1 1 auto', lg: '4' },
                width: '100%',
                bgcolor: 'rgba(255,255,255,0.02)',
                borderRadius: 4,
                p: { xs: 3, md: 4 },
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 3, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '1px', fontSize: 12 }}>
                Routines · {routines.filter(t => t.status === 'completed').length}/{routines.length}
              </Typography>
              {routines.map(task => (
                <Box
                  key={task.id}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 1.75,
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    opacity: task.status === 'completed' ? 0.5 : 1,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>{task.title}</Typography>
                  <Checkbox
                    checked={task.status === 'completed'}
                    onChange={() => handleToggle(task)}
                    size="small"
                    sx={{ '&.Mui-checked': { color: '#60a5fa' } }}
                  />
                </Box>
              ))}
              <Box sx={{ mt: 4 }}>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                  "Clarity comes from focus. Ignore the noise." — Balys AI
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
