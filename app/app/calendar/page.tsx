'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Typography, IconButton, Fab, Button, CircularProgress, TextField, InputAdornment, Select, MenuItem, Autocomplete } from '@mui/material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SearchIcon from '@mui/icons-material/Search';
import dayjs from 'dayjs';

import CalendarGrid from '@/components/calendar/CalendarGrid';
import CalendarWeekGrid from '@/components/calendar/CalendarWeekGrid';
import CalendarDayGrid from '@/components/calendar/CalendarDayGrid';
import FilterPanel, { FilterState } from '@/components/calendar/FilterPanel';
import DayDetailPanel from '@/components/calendar/DayDetailPanel';
import LinkAccountModal from '@/components/calendar/LinkAccountModal';
import EventEditorModal from '@/components/calendar/EventEditorModal';
import { CalendarEvent } from '@/components/calendar/types';
import { buildEventMoveRequest, buildMovedEventTimes } from '@/lib/calendar/event-move';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<dayjs.Dayjs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeFetchRef = useRef<AbortController | null>(null);
  const mutationInFlightRef = useRef(false);

  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    showMicroactivities: true,
    showGoogleEvents: true,
    accountIds: [],
    accountTypes: ['work', 'personal'],
  });

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<dayjs.Dayjs | null>(null);
  const [linkAccountOpen, setLinkAccountOpen] = useState(false);
  const [eventEditorOpen, setEventEditorOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Fetch linked accounts
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/linked-accounts');
      const data = await res.json();
      if (data.ok) {
        setLinkedAccounts(data.accounts || []);
        setFilters(prev => ({
          ...prev,
          accountIds: data.accounts.map((a: any) => a.id),
        }));
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  }, []);

  // Fetch events based on dates and filters
  const fetchEvents = useCallback(async (options: { silent?: boolean; signal?: AbortSignal } = {}) => {
    const { silent = false, signal } = options;
    if (silent) setSyncing(true);
    else setLoading(true);
    setError(null);
    try {
      // Calculate start and end based on current view
      const start = view === 'day' ? currentDate.startOf('day').toISOString() :
                    view === 'week' ? currentDate.startOf('week').toISOString() :
                    currentDate.startOf('month').startOf('week').toISOString();
      
      const end = view === 'day' ? currentDate.endOf('day').toISOString() :
                  view === 'week' ? currentDate.endOf('week').toISOString() :
                  currentDate.endOf('month').endOf('week').toISOString();
      
      const queryParams = new URLSearchParams({
        start,
        end,
        includeMicroactivities: String(filters.showMicroactivities),
        includeGoogleEvents: String(filters.showGoogleEvents),
      });

      if (filters.accountIds.length > 0) {
        queryParams.append('accountIds', filters.accountIds.join(','));
      }
      if (filters.accountTypes.length > 0) {
        queryParams.append('accountTypes', filters.accountTypes.join(','));
      }

      if (!filters.showMicroactivities && !filters.showGoogleEvents) {
        setEvents([]);
        setLastSyncedAt(dayjs());
        return;
      }

      const res = await fetch(`/api/calendar/events?${queryParams.toString()}`, { signal });
      if (signal?.aborted) return;
      const data = await res.json();
      
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || 'Failed to fetch events');
      }

      setEvents(data.events || []);
      setLastSyncedAt(dayjs());
    } catch (err: any) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Error fetching events:', err);
      if (!silent) setError("Some events couldn't be loaded. Try reconnecting your accounts.");
    } finally {
      if (silent) setSyncing(false);
      else setLoading(false);
    }
  }, [currentDate, filters, view]);

  const refreshAfterMutation = useCallback(() => {
    window.setTimeout(() => {
      mutationInFlightRef.current = false;
      fetchEvents({ silent: true });
    }, 1200);
  }, [fetchEvents]);

  const handleEventDrop = async (eventId: string, newStart: string, newEnd?: string) => {
    const targetEvent = events.find(e => e.id === eventId);
    if (!targetEvent) return;

    const moved = buildMovedEventTimes(targetEvent, newStart, newEnd);
    mutationInFlightRef.current = true;

    // Optimistic UI update
    setEvents(prev => prev.map(ev => {
      if (ev.id === eventId) {
        return {
          ...ev,
          start_at: moved.start_at,
          end_at: moved.end_at,
        };
      }
      return ev;
    }));

    try {
      const request = buildEventMoveRequest(targetEvent, moved);
      const res = await fetch(request.url, {
        method: request.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || 'Failed to update event position');
      }
      refreshAfterMutation();
      
    } catch (err: unknown) {
      mutationInFlightRef.current = false;
      const message = err instanceof Error ? err.message : 'Failed to update event position';
      setError(message);
      fetchEvents();
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    const pollGoogle = () => {
      if (document.visibilityState !== 'visible' || mutationInFlightRef.current) return;
      activeFetchRef.current?.abort();
      const controller = new AbortController();
      activeFetchRef.current = controller;
      fetchEvents({ silent: true, signal: controller.signal });
    };

    const intervalId = window.setInterval(pollGoogle, 45000);
    const handleFocus = () => pollGoogle();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') pollGoogle();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      activeFetchRef.current?.abort();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchEvents]);

  const navigatePrev = () => {
    if (view === 'month') setCurrentDate(currentDate.subtract(1, 'month'));
    else if (view === 'week') setCurrentDate(currentDate.subtract(1, 'week'));
    else setCurrentDate(currentDate.subtract(1, 'day'));
  };

  const navigateNext = () => {
    if (view === 'month') setCurrentDate(currentDate.add(1, 'month'));
    else if (view === 'week') setCurrentDate(currentDate.add(1, 'week'));
    else setCurrentDate(currentDate.add(1, 'day'));
  };
  
  const today = () => setCurrentDate(dayjs());

  // Filter events locally by Source and Calendars
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
        if (e.source === 'microactivity' && !filters.showMicroactivities) return false;
        if (e.source === 'google' && !filters.showGoogleEvents) return false;
        
        if (e.account_type && !filters.accountTypes.includes(e.account_type as any)) return false;
        
        if (e.source === 'google' && e.linked_account_id && filters.accountIds.length > 0) {
            if (!filters.accountIds.includes(e.linked_account_id)) return false;
        }
        return true;
    });
  }, [events, filters]);

  // Generate dynamic header title
  let headerTitle = currentDate.format('MMMM YYYY');
  if (view === 'week') {
      const start = currentDate.startOf('week');
      const end = currentDate.endOf('week');
      if (start.month() === end.month()) {
          headerTitle = `${start.format('MMM D')} – ${end.format('D, YYYY')}`;
      } else if (start.year() === end.year()) {
          headerTitle = `${start.format('MMM D')} – ${end.format('MMM D, YYYY')}`;
      } else {
          headerTitle = `${start.format('MMM D, YYYY')} – ${end.format('MMM D, YYYY')}`;
      }
  } else if (view === 'day') {
      headerTitle = currentDate.format('MMMM D, YYYY');
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%', position: 'relative' }}>
      <FilterPanel 
        filters={filters} 
        setFilters={setFilters} 
        linkedAccounts={linkedAccounts}
        onAddAccount={() => setLinkAccountOpen(true)}
        mobileOpen={mobileFilterOpen}
        onMobileClose={() => setMobileFilterOpen(false)}
      />

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', p: { xs: 2, md: 3 }, borderBottom: '1px solid', borderColor: 'divider', gap: 2 }}>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => setMobileFilterOpen(true)} sx={{ display: { md: 'none' } }}>
              <FilterAltIcon />
            </IconButton>
            <Typography
              variant="h5"
              sx={{
                minWidth: 200,
                fontWeight: 700,
                letterSpacing: '-0.5px',
                background: 'linear-gradient(135deg, #e2e8f0 30%, #818cf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {headerTitle}
            </Typography>
            {loading && <CircularProgress size={20} />}
            {!loading && syncing && (
              <Typography variant="caption" color="text.secondary">
                Syncing Google...
              </Typography>
            )}
            {!loading && !syncing && lastSyncedAt && (
              <Typography variant="caption" color="text.disabled" sx={{ display: { xs: 'none', sm: 'block' } }}>
                Synced {lastSyncedAt.format('HH:mm')}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            
            {/* Global Search Bar */}
            <Autocomplete
              options={events}
              getOptionLabel={(option) => option.title}
              filterOptions={(options, state) => {
                  if (!state.inputValue) return [];
                  const q = state.inputValue.toLowerCase();
                  return options.filter(e => e.title.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q));
              }}
              onChange={(_, eventOption) => {
                 if (eventOption) {
                     setSelectedDay(dayjs(eventOption.start_at));
                     setView('day');
                     setEditingEvent(eventOption);
                     setEventEditorOpen(true);
                 }
              }}
              renderInput={(params) => (
                <TextField 
                  {...params}
                  size="small"
                  placeholder="Search events to edit..."
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start"><SearchIcon fontSize="small"/></InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    )
                  }}
                />
              )}
              sx={{ bgcolor: 'background.paper', width: { xs: '100%', sm: 250 }, '& .MuiOutlinedInput-root': { py: 0.5 } }}
            />

            {/* View Selector & Navigation */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Select
                size="small"
                value={view}
                onChange={(e) => setView(e.target.value as any)}
                sx={{ bgcolor: 'background.paper', minWidth: 100 }}
              >
                <MenuItem value="month">Month</MenuItem>
                <MenuItem value="week">Week</MenuItem>
                <MenuItem value="day">Day</MenuItem>
              </Select>
              
              <Button variant="outlined" onClick={today} size="small" sx={{ display: { xs: 'none', sm: 'block' } }}>
                Today
              </Button>
              <IconButton onClick={navigatePrev} size="small"><ChevronLeftIcon /></IconButton>
              <IconButton onClick={navigateNext} size="small"><ChevronRightIcon /></IconButton>
            </Box>

          </Box>
        </Box>

        {error && (
            <Box sx={{ px: 3, py: 1, bgcolor: 'error.light', color: 'error.contrastText' }}>
                <Typography variant="body2">{error}</Typography>
            </Box>
        )}

        {/* Main Grid Area */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 1, md: 3 }, bgcolor: 'background.default' }}>
          {view === 'month' && (
            <CalendarGrid 
              currentDate={currentDate} 
              events={filteredEvents} 
              onDayClick={(date, dayEvents) => {
                setSelectedDay(date);
                setDayDetailOpen(true);
              }}
              onEventClick={(evt) => {
                setEditingEvent(evt);
                setEventEditorOpen(true);
              }}
              onEventDrop={handleEventDrop}
            />
          )}

          {view === 'week' && (
            <CalendarWeekGrid
               currentDate={currentDate}
               events={filteredEvents}
               onEventClick={(evt) => {
                 setEditingEvent(evt);
                 setEventEditorOpen(true);
               }}
               onEventDrop={handleEventDrop}
            />
          )}

          {view === 'day' && (
            <CalendarDayGrid
               currentDate={currentDate}
               events={filteredEvents}
               onEventClick={(evt) => {
                 setEditingEvent(evt);
                 setEventEditorOpen(true);
               }}
               onEventDrop={handleEventDrop}
            />
          )}
        </Box>
      </Box>

      {/* Floating Create Button */}
      <Fab 
        color="primary" 
        onClick={() => {
          setEditingEvent(null);
          setEventEditorOpen(true);
        }}
        sx={{ position: 'absolute', bottom: 32, right: 32 }}
      >
        <AddIcon />
      </Fab>

      {/* Panels/Modals */}
      <DayDetailPanel 
        open={dayDetailOpen} 
        onClose={() => setDayDetailOpen(false)} 
        date={selectedDay} 
        events={selectedDay ? filteredEvents.filter(e => dayjs(e.start_at).isSame(selectedDay, 'day')) : []} 
        onEditEvent={(evt) => {
          setEditingEvent(evt);
          setDayDetailOpen(false);
          setEventEditorOpen(true);
        }}
      />

      <LinkAccountModal 
        open={linkAccountOpen} 
        onClose={() => setLinkAccountOpen(false)} 
        onSuccess={() => {
          fetchAccounts();
          fetchEvents({ silent: true });
        }} 
      />

      <EventEditorModal 
        open={eventEditorOpen} 
        onClose={() => setEventEditorOpen(false)} 
        onSuccess={() => {
          mutationInFlightRef.current = true;
          refreshAfterMutation();
        }} 
        linkedAccounts={linkedAccounts.filter(a => a.is_active)}
        existingEvent={editingEvent}
        allEvents={events}
      />
    </Box>
  );
}
