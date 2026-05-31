export type TaskSourceType = 'calendar_event' | 'goal_task' | 'action_plan_task' | 'manual';
export type TaskExecutionType = 'event';
export type TaskOutcome = 'pending' | 'completed' | 'skipped' | 'not_done' | 'moved' | 'incomplete' | 'blocked' | 'deferred';
export type PrioritySource = 'user' | 'balys' | 'system';

export interface NormalizedTask {
  task_id: string;
  source_type: TaskSourceType;
  source_id: string;
  title: string;
  description: string | null;
  date: string | null;
  start_at: string | null;
  end_at: string | null;
  duration_minutes: number | null;
  execution_type: TaskExecutionType;
  is_time_blocked: boolean;
  outcome: TaskOutcome;
  outcome_reason: string | null;
  priority_score: number;
  priority_source: PrioritySource;
  priority_reason: string | null;
  linked_goal_id: string | null;
  action_plan_id: string | null;
  action_plan_title: string | null;
  plan_day: number | null;
  sort_order: number;
}

export interface DayUnit {
  date: string;
  timezone: string;
  unit_id: string;
  tasks: NormalizedTask[];
  summary: {
    total: number;
    completed: number;
    skipped: number;
    moved: number;
    blocked: number;
    pending: number;
  };
}

interface FlowmeEventRow {
  id: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  status?: string | null;
  priority?: number | null;
  scheduled_date?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  duration_minutes?: number | null;
  linked_goal_id?: string | null;
  action_plan_id?: string | null;
  plan_day?: number | null;
  source_type?: string | null;
  source_id?: string | null;
  outcome?: string | null;
  outcome_reason?: string | null;
  priority_source?: string | null;
  priority_reason?: string | null;
  is_time_blocked?: boolean | null;
  sort_order?: number | null;
}

interface CalendarEventRow {
  id: string;
  title?: string | null;
  description?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  provider_event_id?: string | null;
  linked_account_id?: string | null;
}

const OUTCOMES: TaskOutcome[] = ['pending', 'completed', 'skipped', 'not_done', 'moved', 'incomplete', 'blocked', 'deferred'];
const SOURCES: TaskSourceType[] = ['calendar_event', 'goal_task', 'action_plan_task', 'manual'];
const PRIORITY_SOURCES: PrioritySource[] = ['user', 'balys', 'system'];

export function inferDurationMinutes(startAt?: string | null, endAt?: string | null): number | null {
  if (!startAt || !endAt) return null;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.max(1, Math.ceil((end - start) / 60000));
}

export function classifyExecutionType(_durationMinutes: number | null, _isTimeBlocked?: boolean | null): TaskExecutionType {
  return 'event';
}

export function normalizeFlowmeEventTask(row: FlowmeEventRow): NormalizedTask {
  const duration = row.duration_minutes ?? inferDurationMinutes(row.start_at, row.end_at);
  const sourceType = parseSourceType(row.source_type, 'manual');
  const dbId = row.id;
  const outcome = parseOutcome(row.outcome || row.status);
  const isTimeBlocked = Boolean(row.is_time_blocked) || Boolean(row.start_at && row.end_at);

  return {
    task_id: `${sourceType}:${dbId}`,
    source_type: sourceType,
    source_id: dbId,
    title: row.title,
    description: row.description || row.notes || null,
    date: row.scheduled_date || row.start_at?.slice(0, 10) || null,
    start_at: row.start_at || null,
    end_at: row.end_at || null,
    duration_minutes: duration,
    execution_type: 'event',
    is_time_blocked: isTimeBlocked,
    outcome,
    outcome_reason: row.outcome_reason || null,
    priority_score: typeof row.priority === 'number' ? row.priority : 0,
    priority_source: parsePrioritySource(row.priority_source),
    priority_reason: row.priority_reason || null,
    linked_goal_id: row.linked_goal_id || null,
    action_plan_id: row.action_plan_id || null,
    action_plan_title: null,
    plan_day: typeof row.plan_day === 'number' ? row.plan_day : null,
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : 0,
  };
}

export function normalizeCalendarEventTask(row: CalendarEventRow, date: string): NormalizedTask {
  const duration = inferDurationMinutes(row.start_at, row.end_at);
  const sourceId = row.provider_event_id || row.id;

  return {
    task_id: `calendar_event:${sourceId}`,
    source_type: 'calendar_event',
    source_id: sourceId,
    title: row.title || 'Untitled Event',
    description: row.description || null,
    date,
    start_at: row.start_at || null,
    end_at: row.end_at || null,
    duration_minutes: duration,
    execution_type: 'event',
    is_time_blocked: true,
    outcome: 'pending',
    outcome_reason: null,
    priority_score: 0,
    priority_source: 'system',
    priority_reason: null,
    linked_goal_id: null,
    action_plan_id: null,
    action_plan_title: null,
    plan_day: null,
    sort_order: 0,
  };
}

export function buildDayUnit(date: string, timezone: string, tasks: NormalizedTask[]): DayUnit {
  const sorted = [...tasks].sort(compareTaskPathOrder);

  return {
    date,
    timezone,
    unit_id: `day:${date}`,
    tasks: sorted,
    summary: {
      total: sorted.length,
      completed: sorted.filter(task => task.outcome === 'completed').length,
      skipped: sorted.filter(task => task.outcome === 'skipped' || task.outcome === 'not_done').length,
      moved: sorted.filter(task => task.outcome === 'moved').length,
      blocked: sorted.filter(task => task.outcome === 'blocked').length,
      pending: sorted.filter(task => task.outcome === 'pending').length,
    },
  };
}

export function compareTaskPathOrder(a: NormalizedTask, b: NormalizedTask): number {
  if (a.outcome === 'completed' && b.outcome !== 'completed') return 1;
  if (b.outcome === 'completed' && a.outcome !== 'completed') return -1;
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  const aTime = a.start_at ? new Date(a.start_at).getTime() : Number.POSITIVE_INFINITY;
  const bTime = b.start_at ? new Date(b.start_at).getTime() : Number.POSITIVE_INFINITY;
  if (aTime !== bTime) return aTime - bTime;
  return a.title.localeCompare(b.title);
}

function parseOutcome(value?: string | null): TaskOutcome {
  return OUTCOMES.includes(value as TaskOutcome) ? value as TaskOutcome : 'pending';
}

function parseSourceType(value: string | null | undefined, fallback: TaskSourceType): TaskSourceType {
  return SOURCES.includes(value as TaskSourceType) ? value as TaskSourceType : fallback;
}

function parsePrioritySource(value?: string | null): PrioritySource {
  return PRIORITY_SOURCES.includes(value as PrioritySource) ? value as PrioritySource : 'system';
}
