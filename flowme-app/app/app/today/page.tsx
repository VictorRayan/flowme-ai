'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress,
  Stack, Typography,
} from '@mui/material';
import CheckCircleIcon    from '@mui/icons-material/CheckCircle';
import BlockIcon          from '@mui/icons-material/Block';
import CalendarTodayIcon  from '@mui/icons-material/CalendarToday';
import FlagIcon           from '@mui/icons-material/Flag';
import TrackChangesIcon   from '@mui/icons-material/TrackChanges';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SkipNextIcon       from '@mui/icons-material/SkipNext';
import Link               from 'next/link';
import dayjs              from 'dayjs';
import { UI, type UiLang, resolveUiLang } from '@/lib/i18n';
import BriefingPill from '@/components/briefings/BriefingPill';
import BriefingDialog, { type BriefingSections } from '@/components/briefings/BriefingDialog';

/* ── types ─────────────────────────────────────────────────────────────── */
type TaskOutcome   = 'pending'|'completed'|'skipped'|'moved'|'incomplete'|'blocked'|'deferred';
type PriorityLabel = 'non_negotiable'|'negotiable'|'routine';
type SourceType    = 'calendar_event'|'goal_task'|'action_plan_task'|'manual';

interface NormalizedTask {
  task_id: string; source_type: SourceType; source_id: string;
  title: string; description: string|null;
  date: string|null; start_at: string|null; end_at: string|null;
  duration_minutes: number|null; execution_type: 'event';
  is_time_blocked: boolean; outcome: TaskOutcome; outcome_reason: string|null;
  priority_label: PriorityLabel; priority_score: number;
  priority_source: 'user'|'balys'|'system'; priority_reason: string|null;
  linked_goal_id: string|null; action_plan_id: string|null;
  action_plan_title: string|null; plan_day: number|null; sort_order: number;
}

interface DayUnit {
  date: string; timezone: string; unit_id: string; tasks: NormalizedTask[];
  summary: { total:number; completed:number; skipped:number; moved:number; blocked:number; pending:number };
}

/* ── layout constants ──────────────────────────────────────────────────── */
const BUBBLE = 58;           // circle diameter px
const GAP    = 72;           // vertical gap between bubble centres
const ZIGZAG = [            // bubble centre-x as % of the content width
  50, 68, 50, 32,
  50, 68, 50, 32,
];
function zx(i: number) { return ZIGZAG[i % ZIGZAG.length]; }

/* ── helpers ───────────────────────────────────────────────────────────── */
function sortTasks(tasks: NormalizedTask[]): NormalizedTask[] {
  const timed = [...tasks.filter(t => t.start_at)]
    .sort((a,b) => new Date(a.start_at!).getTime() - new Date(b.start_at!).getTime());
  const flex = [...tasks.filter(t => !t.start_at)]
    .sort((a,b) => pw(b.priority_label) - pw(a.priority_label) || a.sort_order - b.sort_order);
  return [...timed, ...flex];
}
function pw(l: PriorityLabel) { return l==='non_negotiable'?3:l==='negotiable'?2:1; }

function timeLabel(task: NormalizedTask) {
  if (task.start_at) {
    const s = dayjs(task.start_at).format('H:mm');
    const e = task.end_at ? dayjs(task.end_at).format('H:mm') : null;
    return e ? `${s}–${e}` : s;
  }
  return task.duration_minutes ? `${task.duration_minutes}m` : null;
}

/* ── recount summary from tasks array ──────────────────────────────────── */
function recount(tasks: NormalizedTask[]): DayUnit['summary'] {
  return {
    total:     tasks.length,
    completed: tasks.filter(t => t.outcome === 'completed').length,
    skipped:   tasks.filter(t => t.outcome === 'skipped').length,
    moved:     tasks.filter(t => t.outcome === 'moved').length,
    blocked:   tasks.filter(t => t.outcome === 'blocked').length,
    pending:   tasks.filter(t => t.outcome === 'pending').length,
  };
}

/* ── page ──────────────────────────────────────────────────────────────── */
const DAYS_BACK    = 3;
const DAYS_FORWARD = 7;

export default function TodayPage() {
  const [days,    setDays]    = useState<DayUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<string|null>(null);
  const [error,   setError]   = useState<string|null>(null);
  const [uiLang,  setUiLang]  = useState<UiLang>('en');
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingSections, setBriefingSections] = useState<BriefingSections | null>(null);
  const [briefingUserName, setBriefingUserName] = useState<string | undefined>(undefined);

  const openBriefing = useCallback(async () => {
    setBriefingOpen(true);
    if (briefingSections) return;
    setBriefingLoading(true);
    try {
      const r = await fetch('/api/briefings');
      if (r.ok) {
        const j = await r.json();
        if (j.ok && j.briefing?.sections) setBriefingSections(j.briefing.sections);
      }
    } catch {
      // swallow — dialog will show error state per section
    } finally {
      setBriefingLoading(false);
    }
  }, [briefingSections]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/profile');
        if (r.ok) {
          const j = await r.json();
          const name = j?.profile?.name || j?.user?.name || j?.user?.email?.split('@')[0];
          if (name) setBriefingUserName(name);
        }
      } catch { /* ignore */ }
    })();
  }, []);
  const lastFetch  = useRef(0);
  const todayRef   = useRef<HTMLDivElement>(null);
  const tz         = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC', []);
  const today      = dayjs().format('YYYY-MM-DD');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('ui_language') : null;
    setUiLang(resolveUiLang(stored));
    const onStorage = (e: StorageEvent) => { if (e.key === 'ui_language') setUiLang(resolveUiLang(e.newValue)); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const fetchRange = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    const from = dayjs().subtract(DAYS_BACK, 'day').format('YYYY-MM-DD');
    const to   = dayjs().add(DAYS_FORWARD, 'day').format('YYYY-MM-DD');
    try {
      const r = await fetch(`/api/tasks/range?${new URLSearchParams({from, to, timezone: tz})}`);
      const j = await r.json();
      if (!r.ok||!j.ok) throw new Error(j.error?.message||'Failed');
      setDays(j.days); lastFetch.current = Date.now();
    } catch(e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally    { if (!silent) setLoading(false); }
  }, [tz]);

  useEffect(() => { fetchRange(); }, [fetchRange]);

  // scroll today into view after load
  useEffect(() => {
    if (!loading) {
      setTimeout(() => todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [loading]);

  // invalidation
  useEffect(() => {
    const check = () => {
      const ts = Number(localStorage.getItem('balysai_invalidate_today')||localStorage.getItem('balysai_invalidate_calendar')||'0');
      if (ts > lastFetch.current) fetchRange(true);
    };
    const onSt = (e: StorageEvent) => { if (e.key?.startsWith('balysai_invalidate')) fetchRange(true); };
    window.addEventListener('storage', onSt);
    window.addEventListener('focus', check);
    check();
    return () => { window.removeEventListener('storage',onSt); window.removeEventListener('focus',check); };
  }, [fetchRange]);

  // Optimistic update: patch state immediately, sync in background
  const update = async (task: NormalizedTask, body: Record<string,unknown>) => {
    setSaving(task.task_id);

    // Apply optimistically
    const newOutcome = (body.outcome as string) || task.outcome;
    setDays(prev => prev.map(d => ({
      ...d,
      tasks: d.tasks.map(t => t.task_id === task.task_id ? { ...t, outcome: newOutcome as TaskOutcome } : t),
      summary: recount(d.tasks.map(t => t.task_id === task.task_id ? { ...t, outcome: newOutcome as TaskOutcome } : t)),
    })));

    const rollback = () => setDays(prev => prev.map(d => ({
      ...d,
      tasks: d.tasks.map(t => t.task_id === task.task_id ? task : t),
      summary: recount(d.tasks.map(t => t.task_id === task.task_id ? task : t)),
    })));

    try {
      let r: Response;
      if (task.source_type === 'calendar_event') {
        const url = `/api/calendar/events/${encodeURIComponent(task.task_id)}/outcome`;
        if (newOutcome === 'pending') {
          r = await fetch(url, { method: 'DELETE' });
        } else {
          r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outcome: newOutcome, outcome_reason: body.outcome_reason ?? null }),
          });
        }
      } else {
        r = await fetch(`/api/tasks/${task.source_id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
      }
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        rollback();
        throw new Error(j.error?.message || j.error?.code || `HTTP ${r.status}`);
      }
    } catch(e) {
      setError(e instanceof Error ? e.message : 'Failed to update task');
    } finally {
      setSaving(null);
    }
  };

  const moveTo = async (task: NormalizedTask, to: string) => {
    if (task.source_type === 'calendar_event') return;
    setSaving(task.task_id);

    // Optimistically mark as moved
    setDays(prev => prev.map(d => ({
      ...d,
      tasks: d.tasks.map(t => t.task_id === task.task_id ? { ...t, outcome: 'moved' as TaskOutcome } : t),
      summary: recount(d.tasks.map(t => t.task_id === task.task_id ? { ...t, outcome: 'moved' as TaskOutcome } : t)),
    })));

    try {
      const r = await fetch(`/api/tasks/${task.source_id}/move`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ scheduled_date: to, outcome_reason: 'Moved from Today' }),
      });
      const j = await r.json();
      if (!r.ok||!j.ok) {
        setDays(prev => prev.map(d => ({
          ...d,
          tasks: d.tasks.map(t => t.task_id === task.task_id ? task : t),
          summary: recount(d.tasks),
        })));
        throw new Error(j.error?.message || j.error?.code || `HTTP ${r.status}`);
      }
      // Silent refresh to show the new task on the target day
      fetchRange(true);
    } catch(e) { setError(e instanceof Error ? e.message : 'Failed to move task'); }
    finally    { setSaving(null); }
  };

  return (
    <Box sx={{ height:'100%', overflow:'auto', bgcolor:'#090d14' }}>

      {error && (
        <Alert severity="error" onClose={()=>setError(null)}
          sx={{ mx:2, mt:1, py:0, fontSize:12, position:'sticky', top:8, zIndex:100 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display:'grid', placeItems:'center', minHeight:'100%' }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <Box sx={{ pb: 12 }}>
          <BriefingPill userName={briefingUserName} loading={briefingLoading && !briefingSections} onClick={openBriefing} uiLang={uiLang} />
          <BriefingDialog
            open={briefingOpen}
            onClose={() => setBriefingOpen(false)}
            greetingTitle={(() => {
              const hour = new Date().getHours();
              const base = hour < 12 ? (uiLang === 'pt' ? 'Bom dia' : 'Good morning') : hour < 18 ? (uiLang === 'pt' ? 'Boa tarde' : 'Good afternoon') : (uiLang === 'pt' ? 'Boa noite' : 'Good evening');
              return briefingUserName ? `${base}, ${briefingUserName}` : base;
            })()}
            loading={briefingLoading}
            sections={briefingSections}
            uiLang={uiLang}
          />
          {days.map((day, idx) => {
            const hasPrevTrail = days.slice(0, idx).some((d) => d.tasks.length > 0);
            const hasNextTrail = days.slice(idx + 1).some((d) => d.tasks.length > 0);
            return (
              <DaySection
                key={day.date}
                day={day}
                isToday={day.date === today}
                todayRef={day.date === today ? todayRef : undefined}
                saving={saving}
                onUpdate={update}
                onMove={moveTo}
                uiLang={uiLang}
                hasPrevTrail={hasPrevTrail}
                hasNextTrail={hasNextTrail}
              />
            );
          })}
        </Box>
      )}
    </Box>
  );
}

/* ── DaySection: one "unit" like Duolingo ──────────────────────────────── */
function DaySection({ day, isToday, todayRef, saving, onUpdate, onMove, uiLang, hasPrevTrail, hasNextTrail }: {
  day: DayUnit;
  isToday: boolean;
  todayRef?: React.RefObject<HTMLDivElement | null>;
  saving: string|null;
  onUpdate: (task: NormalizedTask, body: Record<string,unknown>) => void;
  onMove:   (task: NormalizedTask, to: string) => void;
  uiLang: UiLang;
  hasPrevTrail?: boolean;
  hasNextTrail?: boolean;
}) {
  const sorted = useMemo(() => sortTasks(day.tasks), [day.tasks]);
  const isWeekend = dayjs(day.date).day() === 0 || dayjs(day.date).day() === 6;
  const isPast    = day.date < dayjs().format('YYYY-MM-DD');
  const tomorrow  = dayjs(day.date).add(1,'day').format('YYYY-MM-DD');
  const t = UI[uiLang].today;

  // Unit header colour
  const headerBg = isToday
    ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
    : isPast
    ? 'rgba(30,41,59,0.7)'
    : isWeekend
    ? 'linear-gradient(135deg, #0f4c75 0%, #1b262c 100%)'
    : 'linear-gradient(135deg, #134e4a 0%, #0f2027 100%)';

  const progress = day.summary.total > 0
    ? Math.round((day.summary.completed / day.summary.total) * 100) : 0;

  return (
    <Box ref={todayRef as React.RefObject<HTMLDivElement>} sx={{ mb: 0 }}>

      {/* ── Unit header (Duolingo section banner) ── */}
      <Box sx={{
        background: headerBg,
        px: { xs: 2.5, md: 4 },
        py: 1.6,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: isToday ? '2px solid rgba(124,58,237,0.6)' : '1px solid rgba(148,163,184,0.07)',
      }}>
        <Box>
          {isToday && (
            <Typography sx={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.6)', letterSpacing:'0.12em', textTransform:'uppercase', lineHeight:1, mb:0.3 }}>
              {t.todayLabel}
            </Typography>
          )}
          <Typography sx={{ fontWeight:800, fontSize:{xs:15,md:17}, letterSpacing:'-0.2px', color:'#fff', lineHeight:1 }}>
            {dayjs(day.date).format(isToday ? 'dddd, MMM D' : 'ddd, MMM D')}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          {day.summary.total > 0 && (
            <Box sx={{
              display:'flex', alignItems:'center', gap:0.75,
              bgcolor:'rgba(0,0,0,0.25)', borderRadius:2, px:1.2, py:0.4,
            }}>
              {/* progress bar */}
              <Box sx={{ width:56, height:5, borderRadius:99, bgcolor:'rgba(255,255,255,0.15)', overflow:'hidden' }}>
                <Box sx={{ height:'100%', width:`${progress}%`, bgcolor: progress===100 ? '#22c55e' : '#a78bfa', borderRadius:99, transition:'width 0.4s ease' }}/>
              </Box>
              <Typography sx={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.7)' }}>
                {day.summary.completed}/{day.summary.total}
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>

      {/* ── Task path ── */}
      {sorted.length === 0 ? (
        <Box sx={{ py:4, textAlign:'center' }}>
          <Typography sx={{ fontSize:13, color:'rgba(148,163,184,0.3)', fontStyle:'italic' }}>
            {isPast ? t.nothingPlannedPast : t.nothingPlannedFuture}
          </Typography>
        </Box>
      ) : (
        <Box sx={{
          position:'relative',
          /* height: N bubbles * GAP + padding */
          height: sorted.length * GAP + BUBBLE + 32,
          mx:'auto',
          maxWidth: 480,
          px: 2,
        }}>
          {/* SVG connector lines between bubble centres */}
          <ConnectorLines tasks={sorted} containerWidth={480} hasPrevTrail={hasPrevTrail} hasNextTrail={hasNextTrail} />

          {sorted.map((task, i) => {
            const cx = zx(i);           // centre-x as %
            const cy = i * GAP + 8;     // top of bubble

            return (
              <TaskBubble
                key={task.task_id}
                task={task}
                cx={cx}
                cy={cy}
                saving={saving === task.task_id}
                onDone={()=>onUpdate(task,{outcome:'completed'})}
                onUndo={()=>onUpdate(task,{outcome:'pending'})}
                onSkip={()=>onUpdate(task,{outcome:'skipped',outcome_reason:'Skipped'})}
                onMove={()=>onMove(task, tomorrow)}
                uiLang={uiLang}
              />
            );
          })}
        </Box>
      )}
    </Box>
  );
}

/* ── ConnectorLines: SVG lines between consecutive bubble centres ───────── */
function ConnectorLines({ tasks, containerWidth, hasPrevTrail, hasNextTrail }: { tasks: NormalizedTask[]; containerWidth: number; hasPrevTrail?: boolean; hasNextTrail?: boolean }) {
  if (tasks.length === 0) return null;
  const w = containerWidth;
  const totalH = tasks.length * GAP + BUBBLE + 32;
  const TRAIL_EXT = 90;

  const firstX = (zx(0) / 100) * w;
  const firstY = 0 + 8 + BUBBLE / 2;
  const lastIdx = tasks.length - 1;
  const lastX = (zx(lastIdx) / 100) * w;
  const lastY = lastIdx * GAP + 8 + BUBBLE / 2;
  const stroke = 'rgba(148,163,184,0.18)';

  return (
    <svg
      style={{ position: 'absolute', top: -TRAIL_EXT, left: 0, width: '100%', height: totalH + TRAIL_EXT * 2, zIndex: 0, pointerEvents: 'none', overflow: 'visible' }}
      viewBox={`0 ${-TRAIL_EXT} ${w} ${totalH + TRAIL_EXT * 2}`}
      preserveAspectRatio="none"
    >
      {hasPrevTrail && (
        <path
          d={`M ${firstX} ${-TRAIL_EXT} C ${firstX} ${-TRAIL_EXT / 2}, ${firstX} ${firstY - TRAIL_EXT / 2}, ${firstX} ${firstY}`}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}

      {tasks.slice(0, -1).map((_, i) => {
        const x1 = (zx(i) / 100) * w;
        const y1 = i * GAP + 8 + BUBBLE / 2;
        const x2 = (zx(i + 1) / 100) * w;
        const y2 = (i + 1) * GAP + 8 + BUBBLE / 2;
        const cy1 = y1 + (y2 - y1) * 0.5;
        const cy2 = y2 - (y2 - y1) * 0.5;
        return (
          <path
            key={i}
            d={`M ${x1} ${y1} C ${x1} ${cy1}, ${x2} ${cy2}, ${x2} ${y2}`}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
          />
        );
      })}

      {hasNextTrail && (
        <path
          d={`M ${lastX} ${lastY} C ${lastX} ${lastY + TRAIL_EXT / 2}, ${lastX} ${totalH + TRAIL_EXT / 2}, ${lastX} ${totalH + TRAIL_EXT}`}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/* ── TaskBubble ─────────────────────────────────────────────────────────── */
function TaskBubble({ task, cx, cy, saving, onDone, onUndo, onSkip, onMove, uiLang }: {
  task: NormalizedTask; cx: number; cy: number;
  saving: boolean; onDone:()=>void; onUndo:()=>void; onSkip:()=>void; onMove:()=>void;
  uiLang: UiLang;
}) {
  const [open, setOpen] = useState(false);
  const isCalendarEvent = task.source_type === 'calendar_event';
  const done     = task.outcome === 'completed';
  const skipped  = task.outcome === 'skipped' || task.outcome === 'moved';
  const blocked  = task.outcome === 'blocked'  || task.outcome === 'deferred';
  const ac       = accentFor(task);
  const tl       = timeLabel(task);
  const t        = UI[uiLang].today;

  // Card pops to the right if bubble is on left half, left if on right half
  const cardSide = cx <= 50 ? 'right' : 'left';

  return (
    <Box sx={{
      position:'absolute',
      top: cy,
      left:`calc(${cx}% - ${BUBBLE/2}px)`,
      width: BUBBLE,
      zIndex: open ? 40 : 5,
    }}>
      {/* time label above bubble */}
      {tl && (
        <Typography sx={{
          textAlign:'center', fontSize:10, fontWeight:700, lineHeight:1, mb:'4px',
          color: done ? 'rgba(148,163,184,0.3)' : ac.label,
          userSelect:'none',
        }}>
          {tl}
        </Typography>
      )}

      {/* circle */}
      <Box
        onClick={()=>setOpen(o=>!o)}
        sx={{
          width:BUBBLE, height:BUBBLE, borderRadius:'50%',
          display:'flex', alignItems:'center', justifyContent:'center',
          bgcolor: done    ? 'rgba(34,197,94,0.15)'
                 : skipped ? 'rgba(139,92,246,0.15)'
                 : blocked ? 'rgba(249,115,22,0.15)'
                 : ac.bg,
          border:`3.5px solid ${done?'#22c55e':skipped?'#8b5cf6':blocked?'#f97316':ac.border}`,
          boxShadow: open
            ? `0 0 0 8px ${ac.border}28, 0 6px 24px ${ac.border}50`
            : `0 4px 16px ${ac.border}30`,
          cursor:'pointer',
          transition:'transform 110ms ease, box-shadow 110ms ease',
          transform: open ? 'scale(1.13)' : 'scale(1)',
          '&:hover': { transform:'scale(1.1)', boxShadow:`0 4px 22px ${ac.border}55` },
          userSelect:'none',
        }}
      >
        {done    ? <CheckCircleIcon sx={{fontSize:26,color:'#22c55e'}}/>
        : skipped ? <SkipNextIcon   sx={{fontSize:26,color:'#8b5cf6'}}/>
        : blocked ? <BlockIcon      sx={{fontSize:26,color:'#f97316'}}/>
        : <BIcon task={task} color={ac.icon}/>}
      </Box>

      {/* popup card */}
      {open && (
        <>
          <Box sx={{position:'fixed',inset:0,zIndex:30}} onClick={()=>setOpen(false)}/>
          <Box sx={{
            position:'absolute',
            top: -8,
            left:  cardSide==='right' ? BUBBLE+10 : 'auto',
            right: cardSide==='left'  ? BUBBLE+10 : 'auto',
            width: 220,
            bgcolor:'#0f172a',
            border:`1px solid ${ac.border}50`,
            borderRadius:2.5,
            p:1.5,
            boxShadow:'0 8px 40px rgba(0,0,0,0.8)',
            zIndex:50,
          }} onClick={e=>e.stopPropagation()}>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{mb:0.6}}>
              <PChip label={task.priority_label} mustDoLabel={t.mustDo}/>
              {task.source_type==='calendar_event' && (
                <Chip size="small" icon={<CalendarTodayIcon/>} label="Cal"
                  sx={{height:18,fontSize:10,bgcolor:'rgba(99,102,241,0.15)',color:'#a5b4fc',
                    '& .MuiChip-icon':{fontSize:11,color:'#a5b4fc'}}}/>
              )}
            </Stack>

            <Typography sx={{fontWeight:700,fontSize:13,lineHeight:1.35,mb:0.4}}>
              {task.title}
            </Typography>

            {tl && (
              <Typography sx={{fontSize:11,fontWeight:600,color:ac.label,mb:0.4}}>
                {tl}
              </Typography>
            )}

            {task.action_plan_title && (
              <Box component={Link} href="/app/goals" onClick={()=>setOpen(false)} sx={{
                display:'inline-flex',alignItems:'center',gap:0.5,mb:0.75,
                px:0.8,py:'2px',borderRadius:1,
                border:'1px solid rgba(251,191,36,0.22)',bgcolor:'rgba(251,191,36,0.08)',
                textDecoration:'none','&:hover':{bgcolor:'rgba(251,191,36,0.16)'},
              }}>
                <TrackChangesIcon sx={{fontSize:10,color:'#fbbf24'}}/>
                <Typography sx={{fontSize:10,color:'#fbbf24',fontWeight:600,lineHeight:1}}>
                  {task.action_plan_title}{task.plan_day?` · Day ${task.plan_day}`:''}
                </Typography>
              </Box>
            )}

            <Stack direction="row" spacing={0.5} sx={{mt:1,flexWrap:'wrap'}}>
              {done ? (
                <ABtn color="#94a3b8" icon={<RadioButtonUncheckedIcon sx={{fontSize:13}}/>} label={t.undo}
                  onClick={()=>{onUndo();setOpen(false);}} disabled={saving}/>
              ) : (
                <>
                  <ABtn color="#22c55e" icon={<CheckCircleIcon sx={{fontSize:13}}/>} label={t.done}
                    onClick={()=>{onDone();setOpen(false);}} disabled={saving}/>
                  {!isCalendarEvent && (
                    <ABtn color="#a78bfa" icon={<SkipNextIcon sx={{fontSize:13}}/>} label={t.tomorrow}
                      onClick={()=>{onMove();setOpen(false);}} disabled={saving}/>
                  )}
                  <ABtn color="#f97316" icon={<BlockIcon sx={{fontSize:13}}/>} label={t.skip}
                    onClick={()=>{onSkip();setOpen(false);}} disabled={saving}/>
                </>
              )}
            </Stack>
          </Box>
        </>
      )}
    </Box>
  );
}

/* ── tiny pieces ─────────────────────────────────────────────────────────── */
function BIcon({task,color}:{task:NormalizedTask;color:string}) {
  if (task.source_type==='calendar_event')    return <CalendarTodayIcon sx={{fontSize:24,color}}/>;
  if (task.priority_label==='non_negotiable') return <FlagIcon          sx={{fontSize:24,color}}/>;
  if (task.action_plan_id)                    return <TrackChangesIcon  sx={{fontSize:24,color}}/>;
  return <RadioButtonUncheckedIcon sx={{fontSize:24,color}}/>;
}

function PChip({label, mustDoLabel}:{label:PriorityLabel; mustDoLabel: string}) {
  const sx = label==='non_negotiable' ? {bgcolor:'rgba(244,63,94,0.15)',color:'#fda4af'}
    : label==='routine'               ? {bgcolor:'rgba(34,197,94,0.12)',color:'#86efac'}
    :                                   {bgcolor:'rgba(34,211,238,0.12)',color:'#67e8f9'};
  return <Chip size="small" label={label==='non_negotiable'? mustDoLabel : label} sx={{height:18,fontSize:10,...sx}}/>;
}

function ABtn({color,icon,label,onClick,disabled}:{color:string;icon:React.ReactNode;label:string;onClick:()=>void;disabled:boolean}) {
  return (
    <Button size="small" onClick={onClick} disabled={disabled} startIcon={icon}
      sx={{minWidth:0,fontSize:11,py:'2px',px:0.9,textTransform:'none',
        color,bgcolor:`${color}18`,border:`1px solid ${color}44`,
        '&:hover':{bgcolor:`${color}28`}}}>
      {label}
    </Button>
  );
}

function accentFor(task: NormalizedTask) {
  if (task.outcome==='completed')                              return {bg:'rgba(34,197,94,0.14)',  border:'#22c55e',icon:'#4ade80',  label:'#22c55e'};
  if (task.outcome==='blocked'||task.outcome==='deferred')     return {bg:'rgba(249,115,22,0.14)', border:'#f97316',icon:'#fb923c',  label:'#f97316'};
  if (task.outcome==='moved'||task.outcome==='skipped')        return {bg:'rgba(139,92,246,0.14)', border:'#8b5cf6',icon:'#a78bfa',  label:'#a78bfa'};
  if (task.source_type==='calendar_event')                     return {bg:'rgba(99,102,241,0.18)', border:'#6366f1',icon:'#a5b4fc',  label:'#818cf8'};
  if (task.priority_label==='non_negotiable')                  return {bg:'rgba(244,63,94,0.18)',  border:'#f43f5e',icon:'#fda4af',  label:'#f43f5e'};
  if (task.priority_label==='routine')                         return {bg:'rgba(34,197,94,0.14)',  border:'#22c55e',icon:'#86efac',  label:'#4ade80'};
  return                                                             {bg:'rgba(34,211,238,0.16)', border:'#22d3ee',icon:'#67e8f9',  label:'#22d3ee'};
}
