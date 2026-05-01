'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Chip, Alert, CircularProgress,
  Divider, alpha, Button, TextField, IconButton, Tooltip,
  List, ListItem, Checkbox, LinearProgress,
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import GroupsIcon from '@mui/icons-material/Groups';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useTheme } from '@mui/material/styles';

type TaskCategory = 'non_negotiable' | 'negotiable' | 'routine';
type TaskStatus = 'pending' | 'completed' | 'skipped';

interface Task {
  id: string;
  title: string;
  description?: string;
  notes?: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: number;
  scheduled_date: string;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  color: string;
  thinking?: string;
}

interface CoworkSession {
  id: string;
  goal: string;
  agents: Agent[];
  tasks: Task[];
  status: 'planning' | 'running' | 'done' | 'idle';
  log: string[];
}

const CATEGORY_META: Record<TaskCategory, { label: string; color: string }> = {
  non_negotiable: { label: 'Non-negotiable', color: '#ef4444' },
  negotiable:     { label: 'Negotiable',     color: '#f59e0b' },
  routine:        { label: 'Routine',        color: '#6366f1' },
};

const AGENT_COLORS = ['#a78bfa', '#34d399', '#fb923c', '#38bdf8', '#f472b6', '#facc15'];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function AgentBadge({ agent, active }: { agent: Agent; active?: boolean }) {
  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 1.5, py: 0.75, borderRadius: 2,
        border: '1px solid', borderColor: active ? agent.color : 'rgba(255,255,255,0.08)',
        bgcolor: active ? alpha(agent.color, 0.12) : 'transparent',
        transition: 'all 0.2s',
      }}
    >
      <SmartToyIcon sx={{ fontSize: 15, color: agent.color }} />
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 700, color: agent.color, display: 'block', lineHeight: 1.2 }}>
          {agent.name}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 10, display: 'block' }}>
          {agent.role}
        </Typography>
      </Box>
    </Box>
  );
}

function TaskItem({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const meta = CATEGORY_META[task.category];
  const done = task.status === 'completed';
  return (
    <ListItem
      disableGutters
      sx={{ px: 2, py: 1.25, opacity: done ? 0.5 : 1, transition: 'opacity 0.2s' }}
    >
      <Checkbox
        checked={done}
        icon={<RadioButtonUncheckedIcon />}
        checkedIcon={<CheckCircleIcon />}
        onChange={onToggle}
        size="small"
        sx={{ color: alpha(meta.color, 0.4), '&.Mui-checked': { color: meta.color }, mr: 1, p: 0.5 }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: meta.color, flexShrink: 0 }} />
          <Typography
            variant="body2"
            sx={{ fontWeight: 500, textDecoration: done ? 'line-through' : 'none', color: done ? 'text.disabled' : 'text.primary' }}
          >
            {task.title}
          </Typography>
          <Chip label={meta.label} size="small" sx={{ height: 16, fontSize: 10, ml: 'auto', flexShrink: 0, bgcolor: alpha(meta.color, 0.1), color: meta.color }} />
        </Box>
        {task.description && (
          <Typography variant="caption" color="text.disabled" sx={{ pl: 2, display: 'block', mt: 0.25 }}>
            {task.description}
          </Typography>
        )}
      </Box>
    </ListItem>
  );
}

export default function CoworkPage() {
  const theme = useTheme();
  const [session, setSession] = useState<CoworkSession | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [launching, setLaunching] = useState(false);
  const [coworkError, setCoworkError] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Fetch today's AI-created tasks
  const fetchTasks = useCallback(async () => {
    setLoadingTasks(true);
    setTaskError(null);
    try {
      const res = await fetch(`/api/tasks?date=${todayISO()}&limit=100`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to load tasks');
      setTasks(data.tasks);
    } catch (err: any) {
      setTaskError(err.message);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.log]);

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

  const launchCowork = async () => {
    if (!prompt.trim()) return;
    setCoworkError(null);
    setLaunching(true);

    // Build a cowork session optimistically — Balys will plan agents and tasks
    const goal = prompt.trim();
    setPrompt('');

    // Determine how many agents based on complexity signals
    const wordCount = goal.split(/\s+/).length;
    const hasMultiple = /\band\b|also|then|plus|\+|,/.test(goal.toLowerCase());
    const agentCount = wordCount > 20 || hasMultiple ? Math.min(4, 2 + Math.floor(wordCount / 15)) : 2;

    const agentRoles = [
      { name: 'Planner', role: 'Breaks goal into tasks' },
      { name: 'Executor', role: 'Executes and validates' },
      { name: 'Critic', role: 'Reviews quality' },
      { name: 'Coordinator', role: 'Aligns priorities' },
    ].slice(0, agentCount).map((a, i) => ({
      id: `agent-${i}`,
      ...a,
      color: AGENT_COLORS[i % AGENT_COLORS.length],
    }));

    const optimisticSession: CoworkSession = {
      id: crypto.randomUUID(),
      goal,
      agents: agentRoles,
      tasks: [],
      status: 'planning',
      log: [`[Balys Cowork] Starting session for: "${goal}"`, `[Balys] Assembling ${agentCount} agents…`],
    };
    setSession(optimisticSession);

    try {
      // Ask Balys via chat to plan and create tasks
      const systemPrompt = `You are Balys Cowork coordinator. The user wants to accomplish a goal using a team of ${agentCount} AI agents.

Your job:
1. Break the goal into 3-7 concrete tasks
2. For each task decide: category (non_negotiable | negotiable | routine), priority (0-3)
3. Create each task via POST /api/tasks
4. Return a brief plan summary

Agents assigned: ${agentRoles.map(a => `${a.name} (${a.role})`).join(', ')}

Respond with a brief plan in plain text. Be concise.`;

      const chatRes = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Cowork goal: ${goal}\n\nPlan tasks for this goal and create them using the tasks API. Today's date: ${todayISO()}` }],
          systemAddendum: systemPrompt,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          clientNowIso: new Date().toISOString(),
        }),
      });

      if (!chatRes.ok) throw new Error('Balys could not plan this session');

      const plan = await chatRes.text();

      // After Balys responds, create the tasks directly
      const taskPayloads: Array<{ title: string; description?: string; category: TaskCategory; priority: number }> = [];

      // Parse simple task lines from Balys response or create generic breakdown
      const lines = plan.split('\n').filter(l => l.trim() && (l.match(/^\d+\./) || l.match(/^[-•*]/)));
      if (lines.length > 0) {
        lines.slice(0, 6).forEach((line, i) => {
          const title = line.replace(/^[\d\.\-•*\s]+/, '').trim();
          if (title.length > 3) {
            taskPayloads.push({
              title,
              category: i === 0 ? 'non_negotiable' : i < 3 ? 'negotiable' : 'routine',
              priority: i === 0 ? 2 : 1,
            });
          }
        });
      }

      // If Balys didn't produce parseable tasks, create a single task for the goal
      if (taskPayloads.length === 0) {
        taskPayloads.push({ title: goal, category: 'negotiable', priority: 1 });
      }

      const createdTasks: Task[] = [];
      const log = [...optimisticSession.log, `[Balys] Plan ready. Creating ${taskPayloads.length} tasks…`];

      for (let i = 0; i < taskPayloads.length; i++) {
        const p = taskPayloads[i];
        const agent = agentRoles[i % agentRoles.length];
        log.push(`[${agent.name}] Creating: "${p.title}"`);
        setSession(prev => prev ? { ...prev, log: [...log], status: 'running' } : prev);

        try {
          const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...p, scheduled_date: todayISO(), start_at: new Date().toISOString() }),
          });
          const data = await res.json();
          if (res.ok && data.ok) createdTasks.push(data.task);
        } catch {
          log.push(`[${agent.name}] Failed to create task, skipping.`);
        }
      }

      log.push(`[Balys Cowork] Session complete. ${createdTasks.length} task(s) created.`);
      setSession(prev => prev ? { ...prev, tasks: createdTasks, status: 'done', log } : prev);
      setTasks(prev => [...createdTasks, ...prev]);
    } catch (err: any) {
      setCoworkError(err.message);
      setSession(prev => prev ? { ...prev, status: 'idle', log: [...(prev.log), `[Error] ${err.message}`] } : prev);
    } finally {
      setLaunching(false);
    }
  };

  const done = tasks.filter(t => t.status === 'completed').length;
  const progress = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: { xs: 2, md: 4 }, bgcolor: '#0a0a0d' }}>
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>

        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <GroupsIcon sx={{ color: 'primary.main', fontSize: 28 }} />
            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.5px', color: '#fff' }}>
              Balys Cowork
            </Typography>
            <Chip
              label="AI-powered"
              size="small"
              icon={<AutoFixHighIcon sx={{ fontSize: '14px !important' }} />}
              sx={{ bgcolor: alpha(theme.palette.primary.main, 0.15), color: 'primary.light', fontWeight: 600 }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Describe a goal. Balys assembles a team of AI agents, plans the work, and creates your tasks automatically.
          </Typography>
        </Box>

        {/* Prompt input */}
        <Paper
          elevation={0}
          sx={{ p: 2.5, mb: 4, border: '1px solid', borderColor: launching ? 'primary.main' : 'rgba(255,255,255,0.08)', borderRadius: 3, bgcolor: 'rgba(255,255,255,0.02)', transition: 'border-color 0.2s' }}
        >
          <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 1.5, display: 'block' }}>
            What do you want to accomplish?
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
            <TextField
              multiline
              maxRows={4}
              fullWidth
              placeholder="e.g. Plan my product launch for next week, create content calendar, and set up email campaign"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) launchCowork(); }}
              variant="standard"
              InputProps={{ disableUnderline: true }}
              sx={{ '& textarea': { color: '#fff', fontSize: 15 }, '& .MuiInputBase-root': { p: 0 } }}
            />
            <Tooltip title="Launch Cowork (Ctrl+Enter)">
              <span>
                <IconButton
                  onClick={launchCowork}
                  disabled={launching || !prompt.trim()}
                  sx={{
                    bgcolor: 'primary.main', color: '#fff', borderRadius: 2,
                    '&:hover': { bgcolor: 'primary.dark' },
                    '&:disabled': { bgcolor: 'rgba(255,255,255,0.05)', color: 'text.disabled' },
                    width: 40, height: 40, flexShrink: 0,
                  }}
                >
                  {launching ? <CircularProgress size={18} sx={{ color: 'inherit' }} /> : <SendIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Paper>

        {coworkError && <Alert severity="error" sx={{ mb: 3 }}>{coworkError}</Alert>}

        {/* Active cowork session */}
        {session && (
          <Paper
            elevation={0}
            sx={{ mb: 4, border: '1px solid', borderColor: session.status === 'done' ? 'success.dark' : 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}
          >
            {/* Session header */}
            <Box sx={{ px: 3, py: 2, bgcolor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Chip
                  label={session.status === 'planning' ? 'Planning…' : session.status === 'running' ? 'Working…' : 'Done'}
                  size="small"
                  color={session.status === 'done' ? 'success' : 'primary'}
                  sx={{ fontWeight: 700 }}
                />
                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500, flex: 1 }} noWrap>
                  {session.goal}
                </Typography>
              </Box>
              {/* Agent badges */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {session.agents.map((agent, i) => (
                  <AgentBadge key={agent.id} agent={agent} active={session.status === 'running' && i === session.log.length % session.agents.length} />
                ))}
              </Box>
            </Box>

            {/* Live log */}
            {session.status !== 'idle' && (
              <Box sx={{ px: 3, py: 2, maxHeight: 160, overflow: 'auto', fontFamily: 'monospace', bgcolor: '#0d0d12' }}>
                {session.log.map((line, i) => (
                  <Typography key={i} variant="caption" sx={{ display: 'block', color: line.includes('[Error]') ? 'error.main' : line.includes('complete') ? 'success.main' : 'text.secondary', lineHeight: 1.8 }}>
                    {line}
                  </Typography>
                ))}
                {session.status === 'running' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <CircularProgress size={10} sx={{ color: 'primary.main' }} />
                    <Typography variant="caption" color="primary.main">Working…</Typography>
                  </Box>
                )}
                <div ref={logEndRef} />
              </Box>
            )}

            {/* Tasks created in this session */}
            {session.tasks.length > 0 && (
              <>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {session.tasks.length} task{session.tasks.length > 1 ? 's' : ''} created
                  </Typography>
                </Box>
                <List disablePadding>
                  {session.tasks.map((task, idx) => (
                    <React.Fragment key={task.id}>
                      {idx > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />}
                      <TaskItem task={task} onToggle={() => handleToggle(task)} />
                    </React.Fragment>
                  ))}
                </List>
              </>
            )}
          </Paper>
        )}

        {/* Today's tasks */}
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 11 }}>
            Today's tasks
          </Typography>
          {tasks.length > 0 && (
            <Typography variant="caption" color="text.disabled">
              {done}/{tasks.length} done
            </Typography>
          )}
        </Box>

        {tasks.length > 0 && (
          <Box sx={{ mb: 2, height: 3, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${progress}%`, bgcolor: 'primary.main', borderRadius: 2, transition: 'width 0.4s ease' }} />
          </Box>
        )}

        {taskError && <Alert severity="error" sx={{ mb: 2 }}>{taskError}</Alert>}

        {loadingTasks ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress sx={{ color: 'primary.main' }} />
          </Box>
        ) : tasks.length === 0 ? (
          <Paper
            elevation={0}
            sx={{ p: 5, textAlign: 'center', border: '1px dashed', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 3 }}
          >
            <SmartToyIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1.5 }} />
            <Typography variant="h6" fontWeight={600} color="text.secondary" gutterBottom>
              No tasks yet
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mb: 0 }}>
              Describe a goal above and Balys will plan and create your tasks automatically.
            </Typography>
          </Paper>
        ) : (
          <Paper elevation={0} sx={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
            <List disablePadding>
              {tasks.map((task, idx) => (
                <React.Fragment key={task.id}>
                  {idx > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />}
                  <TaskItem task={task} onToggle={() => handleToggle(task)} />
                </React.Fragment>
              ))}
            </List>
          </Paper>
        )}

      </Box>
    </Box>
  );
}
