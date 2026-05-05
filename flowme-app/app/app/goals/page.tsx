'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FlagIcon from '@mui/icons-material/Flag';
import InsightsIcon from '@mui/icons-material/Insights';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import dayjs from 'dayjs';

type GoalTimeframe = 'yearly' | 'monthly' | 'weekly';
type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'cancelled';
type PriorityLabel = 'non_negotiable' | 'negotiable' | 'routine';

interface Goal {
  id: string;
  title: string;
  description: string | null;
  timeframe: GoalTimeframe;
  parent_goal_id: string | null;
  status: GoalStatus;
  target_date: string | null;
  objective_metric: string | null;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  starts_on: string | null;
  due_on: string | null;
  success_criteria: string | null;
}

interface ActionPlan {
  id: string;
  title: string;
  description: string | null;
  linked_goal_id: string | null;
  linked_goal_ids: string[] | null;
  plan_type: 'goal_plan' | 'short_term_problem';
  problem_statement: string | null;
  status: GoalStatus;
  duration_days: number | null;
  starts_on: string | null;
  review_date: string | null;
  success_criteria: string | null;
  priority_label: PriorityLabel;
}

interface Task {
  id: string;
  title: string;
  category: PriorityLabel | null;
  status: string | null;
  outcome: string | null;
  scheduled_date: string | null;
  linked_goal_id: string | null;
  action_plan_id: string | null;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [goalsRes, plansRes, tasksRes] = await Promise.all([
        fetch('/api/goals'),
        fetch('/api/action-plans'),
        fetch('/api/tasks?limit=200'),
      ]);
      const [goalsJson, plansJson, tasksJson] = await Promise.all([
        goalsRes.json(),
        plansRes.json(),
        tasksRes.json(),
      ]);
      if (!goalsRes.ok || !goalsJson.ok) throw new Error(goalsJson.error?.message || 'Failed to load goals');
      if (!plansRes.ok || !plansJson.ok) throw new Error(plansJson.error?.message || 'Failed to load action plans');
      if (!tasksRes.ok || !tasksJson.ok) throw new Error(tasksJson.error?.message || 'Failed to load tasks');
      setGoals(goalsJson.goals || []);
      setActionPlans(plansJson.action_plans || []);
      setTasks(tasksJson.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'balysai_invalidate_goals' || event.key === 'balysai_invalidate_today') fetchGoals();
    };
    const handleFocus = () => {
      const goalsInvalidatedAt = Number(localStorage.getItem('balysai_invalidate_goals') || '0');
      const todayInvalidatedAt = Number(localStorage.getItem('balysai_invalidate_today') || '0');
      if (goalsInvalidatedAt > 0 || todayInvalidatedAt > 0) fetchGoals();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchGoals]);

  const grouped = useMemo(() => ({
    yearly: goals.filter(goal => goal.timeframe === 'yearly'),
    monthly: goals.filter(goal => goal.timeframe === 'monthly'),
    weekly: goals.filter(goal => goal.timeframe === 'weekly'),
  }), [goals]);

  const activeGoals = goals.filter(goal => goal.status === 'in_progress' || goal.status === 'not_started');
  const activePlans = actionPlans.filter(plan => plan.status === 'in_progress' || plan.status === 'not_started');
  const linkedTaskCount = tasks.filter(task => task.linked_goal_id || task.action_plan_id).length;
  const completedTaskCount = tasks.filter(task => task.status === 'completed' || task.outcome === 'completed').length;
  const completionRate = linkedTaskCount > 0 ? Math.round((completedTaskCount / linkedTaskCount) * 100) : 0;

  return (
    <Box sx={{ height: '100%', overflow: 'auto', bgcolor: '#090d14' }}>
      <Box sx={{ maxWidth: 1240, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 2.5, md: 4 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2.5} sx={{ mb: 3 }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Chip size="small" icon={<TrackChangesIcon />} label="Goal OS" sx={{ bgcolor: 'rgba(20,184,166,0.14)', color: '#5eead4', border: '1px solid rgba(94,234,212,0.24)' }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Year, month, week, and recovery plans
              </Typography>
            </Stack>
            <Typography variant="h3" sx={{ fontWeight: 800, fontSize: { xs: 30, md: 42 }, letterSpacing: 0 }}>
              Goals Dashboard
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button component={Link} href="/app/today" variant="outlined" endIcon={<ArrowForwardIcon />} sx={{ borderColor: 'rgba(148,163,184,0.25)', color: 'text.primary' }}>
              Today Path
            </Button>
            <Button component={Link} href="/app/ai" variant="contained" sx={{ bgcolor: '#4f46e5' }}>
              Ask Balys
            </Button>
          </Stack>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 420 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ py: 2.5, borderTop: '1px solid rgba(148,163,184,0.14)', borderBottom: '1px solid rgba(148,163,184,0.14)', mb: 3 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Metric label="Active goals" value={activeGoals.length} tone="#5eead4" />
                <Metric label="Action plans" value={activePlans.length} tone="#fbbf24" />
                <Metric label="Linked tasks" value={linkedTaskCount} tone="#93c5fd" />
                <Metric label="Task completion" value={`${completionRate}%`} tone="#86efac" />
              </Stack>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 360px' }, gap: 3 }}>
              <Stack spacing={3}>
                <GoalBand title="Year" subtitle="The long arc" goals={grouped.yearly} tasks={tasks} accent="#5eead4" />
                <GoalBand title="Month" subtitle="The current milestone" goals={grouped.monthly} tasks={tasks} accent="#93c5fd" />
                <GoalBand title="Week" subtitle="The execution commitment" goals={grouped.weekly} tasks={tasks} accent="#fbbf24" />
              </Stack>

              <Box sx={{ borderLeft: { xl: '1px solid rgba(148,163,184,0.14)' }, pl: { xl: 3 } }}>
                <Typography variant="overline" sx={{ color: '#fbbf24', letterSpacing: 1.4 }}>
                  Action Plans
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 0, mb: 2 }}>
                  Active problem-solving loops
                </Typography>
                <Stack spacing={1.5}>
                  {activePlans.length > 0 ? activePlans.map(plan => (
                    <ActionPlanItem key={plan.id} plan={plan} tasks={tasks.filter(task => task.action_plan_id === plan.id)} />
                  )) : (
                    <EmptyState title="No active action plans" body="When a recurring problem threatens progress, Balys can create a short-term plan here." />
                  )}
                </Stack>

                <Divider sx={{ my: 3 }} />

                <Typography variant="overline" sx={{ color: '#93c5fd', letterSpacing: 1.4 }}>
                  Next linked tasks
                </Typography>
                <Stack spacing={1.1} sx={{ mt: 1.5 }}>
                  {tasks
                    .filter(task => (task.linked_goal_id || task.action_plan_id) && task.status !== 'completed' && task.outcome !== 'completed')
                    .sort((a, b) => String(a.scheduled_date || '').localeCompare(String(b.scheduled_date || '')))
                    .slice(0, 6)
                    .map(task => (
                      <Box key={task.id} sx={{ py: 1.2, borderBottom: '1px solid rgba(148,163,184,0.11)' }}>
                        <Typography sx={{ fontWeight: 700 }}>{task.title}</Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.6 }}>
                          <Chip size="small" label={task.category || 'negotiable'} sx={priorityChipSx(task.category || 'negotiable')} />
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {task.scheduled_date ? dayjs(task.scheduled_date).format('MMM D') : 'unscheduled'}
                          </Typography>
                        </Stack>
                      </Box>
                    ))}
                </Stack>
              </Box>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

function GoalBand({ title, subtitle, goals, tasks, accent }: { title: string; subtitle: string; goals: Goal[]; tasks: Task[]; accent: string }) {
  return (
    <Box sx={{ py: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 1.5 }}>
        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: accent, boxShadow: `0 0 12px ${accent}` }} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0 }}>
            {title}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {subtitle}
          </Typography>
        </Box>
      </Stack>

      {goals.length > 0 ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
          {goals.map(goal => (
            <GoalItem key={goal.id} goal={goal} tasks={tasks.filter(task => task.linked_goal_id === goal.id)} accent={accent} />
          ))}
        </Box>
      ) : (
        <EmptyState title={`No ${title.toLowerCase()} goals yet`} body="Ask Balys to create a goal operating plan when you are ready." />
      )}
    </Box>
  );
}

function GoalItem({ goal, tasks, accent }: { goal: Goal; tasks: Task[]; accent: string }) {
  const progress = calculateGoalProgress(goal, tasks);
  const complete = tasks.filter(task => task.status === 'completed' || task.outcome === 'completed').length;

  return (
    <Box sx={{
      p: 2,
      borderRadius: 2,
      border: '1px solid rgba(148,163,184,0.15)',
      bgcolor: 'rgba(15,23,42,0.58)',
    }}>
      <Stack direction="row" justifyContent="space-between" spacing={1.2} alignItems="flex-start">
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }}>{goal.title}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.7, lineHeight: 1.55 }}>
            {goal.success_criteria || goal.description || 'No success criteria yet.'}
          </Typography>
        </Box>
        <Chip size="small" label={goal.status.replace('_', ' ')} sx={{ bgcolor: 'rgba(148,163,184,0.12)', color: 'text.secondary', flexShrink: 0 }} />
      </Stack>
      <Box sx={{ mt: 2 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.8 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Progress</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{progress}%</Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 7,
            borderRadius: 99,
            bgcolor: 'rgba(148,163,184,0.16)',
            '& .MuiLinearProgress-bar': { bgcolor: accent, borderRadius: 99 },
          }}
        />
      </Box>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mt: 1.4 }}>
        <Chip size="small" icon={<FlagIcon />} label={`${complete}/${tasks.length || 0} tasks`} sx={{ bgcolor: 'rgba(99,102,241,0.13)', color: '#c4b5fd' }} />
        {goal.due_on && <Chip size="small" label={`Due ${dayjs(goal.due_on).format('MMM D')}`} sx={{ bgcolor: 'rgba(20,184,166,0.12)', color: '#5eead4' }} />}
      </Stack>
    </Box>
  );
}

function ActionPlanItem({ plan, tasks }: { plan: ActionPlan; tasks: Task[] }) {
  const complete = tasks.filter(task => task.status === 'completed' || task.outcome === 'completed').length;
  const progress = tasks.length > 0 ? Math.round((complete / tasks.length) * 100) : 0;
  return (
    <Box sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(148,163,184,0.15)', bgcolor: 'rgba(15,23,42,0.58)' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <InsightsIcon sx={{ fontSize: 18, color: plan.plan_type === 'short_term_problem' ? '#fbbf24' : '#93c5fd' }} />
        <Chip size="small" label={plan.plan_type === 'short_term_problem' ? 'short-term' : 'goal plan'} sx={{ bgcolor: 'rgba(251,191,36,0.12)', color: '#fbbf24' }} />
        <Chip size="small" label={plan.priority_label} sx={priorityChipSx(plan.priority_label)} />
      </Stack>
      <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }}>{plan.title}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.8, lineHeight: 1.55 }}>
        {plan.problem_statement || plan.description || plan.success_criteria || 'No plan context yet.'}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ height: 6, borderRadius: 99, mt: 1.6, bgcolor: 'rgba(148,163,184,0.16)', '& .MuiLinearProgress-bar': { bgcolor: '#fbbf24' } }}
      />
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{complete}/{tasks.length} tasks</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {plan.review_date ? `Review ${dayjs(plan.review_date).format('MMM D')}` : 'No review date'}
        </Typography>
      </Stack>
    </Box>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 155, p: 1.5, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.48)', border: '1px solid rgba(148,163,184,0.13)' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="h5" sx={{ color: tone, fontWeight: 850, letterSpacing: 0, mt: 0.4 }}>{value}</Typography>
    </Box>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Box sx={{ p: 2, borderRadius: 2, border: '1px dashed rgba(148,163,184,0.22)', bgcolor: 'rgba(15,23,42,0.34)' }}>
      <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{body}</Typography>
    </Box>
  );
}

function calculateGoalProgress(goal: Goal, tasks: Task[]): number {
  if (typeof goal.target_value === 'number' && goal.target_value > 0) {
    const current = typeof goal.current_value === 'number' ? goal.current_value : 0;
    return Math.min(100, Math.max(0, Math.round((current / goal.target_value) * 100)));
  }
  if (tasks.length > 0) {
    const complete = tasks.filter(task => task.status === 'completed' || task.outcome === 'completed').length;
    return Math.round((complete / tasks.length) * 100);
  }
  if (goal.status === 'completed') return 100;
  if (goal.status === 'in_progress') return 20;
  return 0;
}

function priorityChipSx(label: string) {
  if (label === 'non_negotiable') return { bgcolor: 'rgba(239,68,68,0.13)', color: '#fca5a5' };
  if (label === 'routine') return { bgcolor: 'rgba(20,184,166,0.13)', color: '#5eead4' };
  return { bgcolor: 'rgba(147,197,253,0.13)', color: '#93c5fd' };
}
