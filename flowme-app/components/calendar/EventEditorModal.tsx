import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem, Alert, CircularProgress, FormControlLabel, Switch, Autocomplete, Chip, Box, Typography } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';
import { CalendarEvent } from './types';

interface EventEditorModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  linkedAccounts: any[];
  existingEvent?: CalendarEvent | null;
  allEvents?: CalendarEvent[];
}

export default function EventEditorModal({ open, onClose, onSuccess, linkedAccounts, existingEvent, allEvents = [] }: EventEditorModalProps) {
  const isEditing = !!existingEvent;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [locationOptions, setLocationOptions] = useState<any[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  
  const [accountId, setAccountId] = useState('');
  const [startAt, setStartAt] = useState<dayjs.Dayjs | null>(dayjs().add(1, 'hour').startOf('hour'));
  const [endAt, setEndAt] = useState<dayjs.Dayjs | null>(dayjs().add(2, 'hour').startOf('hour'));
  const [createMeet, setCreateMeet] = useState(false);
  
  const [participants, setParticipants] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');

  // Notifications
  const [customNotification, setCustomNotification] = useState(false);
  const [notificationMinutes, setNotificationMinutes] = useState(30);
  const [notificationMethod, setNotificationMethod] = useState('popup');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Unique guests from all previous events
  const allUniqueGuests = React.useMemo(() => {
    const guests = new Set<string>();
    allEvents.forEach(e => {
      e.participants?.forEach(p => {
        if (p.email) guests.add(p.email.toLowerCase());
      });
    });
    return Array.from(guests);
  }, [allEvents]);

  // Debounced location search
  useEffect(() => {
    let active = true;
    if (location.trim().length <= 2) {
      setLocationOptions([]);
      return undefined;
    }
    
    const handler = setTimeout(async () => {
      setLocationLoading(true);
      try {
        const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(location)}`);
        const data = await res.json();
        if (active && data.ok) {
          setLocationOptions(data.predictions || []);
        }
      } catch (err) {
        console.error('Failed to fetch places', err);
      } finally {
        if (active) setLocationLoading(false);
      }
    }, 500);

    return () => {
      active = false;
      clearTimeout(handler);
    };
  }, [location]);

  // Initialize form
  useEffect(() => {
    if (open) {
      if (isEditing && existingEvent) {
        setTitle(existingEvent.title || '');
        setDescription(existingEvent.description || '');
        setLocation(existingEvent.location || '');
        setAccountId(existingEvent.linked_account_id || '');
        setStartAt(dayjs(existingEvent.start_at));
        setEndAt(existingEvent.end_at ? dayjs(existingEvent.end_at) : dayjs(existingEvent.start_at).add(1, 'hour'));
        setParticipants(existingEvent.participants?.map(p => p.email) || []);
        setCreateMeet(!!existingEvent.meet_link);
        
        // Map reminders if available
        if (existingEvent.reminders && !existingEvent.reminders.useDefault && existingEvent.reminders.overrides && existingEvent.reminders.overrides.length > 0) {
            setCustomNotification(true);
            setNotificationMethod(existingEvent.reminders.overrides[0].method);
            setNotificationMinutes(existingEvent.reminders.overrides[0].minutes);
        } else {
            setCustomNotification(false);
            setNotificationMinutes(30);
            setNotificationMethod('popup');
        }
      } else {
        // Create Mode Defaults
        setTitle('');
        setDescription('');
        setLocation('');
        setAccountId(linkedAccounts.length === 1 ? linkedAccounts[0].id : '');
        setStartAt(dayjs().add(1, 'hour').startOf('hour'));
        setEndAt(dayjs().add(2, 'hour').startOf('hour'));
        setCreateMeet(false);
        setParticipants([]);
        setCustomNotification(false);
        setNotificationMinutes(30);
        setNotificationMethod('popup');
      }
      setEmailInput('');
      setError(null);
    }
  }, [open, isEditing, existingEvent, linkedAccounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startAt || !endAt) {
        setError('Start and end times are required');
        return;
    }
    if (endAt.isBefore(startAt) || endAt.isSame(startAt)) {
        setError('End time must be after start time');
        return;
    }

    if (linkedAccounts.length > 0 && !accountId && !isEditing) {
       setError('Please select an account.');
       return;
    }

    setError(null);
    setLoading(true);

    const finalParticipants = [...participants];
    if (emailInput && emailInput.trim() && !finalParticipants.includes(emailInput.trim())) {
      finalParticipants.push(emailInput.trim());
    }

    const payloadReminders = customNotification 
      ? { useDefault: false, overrides: [{ method: notificationMethod, minutes: notificationMinutes }] }
      : { useDefault: true };

    try {
      if (isEditing) {
        {
          const res = await fetch('/api/calendar/edit-event', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_id: existingEvent.id,
              linked_account_id: accountId || existingEvent.linked_account_id,
              title,
              description,
              location,
              start_at: startAt.toISOString(),
              end_at: endAt.toISOString(),
              create_meet: createMeet && !existingEvent.meet_link,
              participants: finalParticipants,
              reminders: payloadReminders,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to update event');
        }

      } else {
        // POST / Create
          if (linkedAccounts.length === 0) {
            throw new Error('Connect Google Calendar before creating events.');
          } else {
          const res = await fetch('/api/calendar/create-event', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                linked_account_id: accountId,
                title,
                description,
                location,
                start_at: startAt.toISOString(),
                end_at: endAt.toISOString(),
                create_meet: createMeet,
                participants: finalParticipants,
                reminders: payloadReminders
              }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to create google event');
        }
      }
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={!loading ? onClose : undefined} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{isEditing ? 'Edit Event' : 'Create Event'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
          <TextField
            autoFocus
            margin="dense"
            label="Event Title"
            type="text"
            fullWidth
            variant="outlined"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sx={{ mb: 2 }}
          />
          
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <DateTimePicker
              label="Start Time"
              value={startAt}
              onChange={(newValue) => setStartAt(newValue)}
              sx={{ flexGrow: 1 }}
            />
            <DateTimePicker
              label="End Time"
              value={endAt}
              onChange={(newValue) => setEndAt(newValue)}
              sx={{ flexGrow: 1 }}
            />
          </Box>

          <Autocomplete
             freeSolo
             filterOptions={(x) => x}
             options={locationOptions.map(option => option.description)}
             loading={locationLoading}
             value={location}
             onInputChange={(_, newValue) => setLocation(newValue)}
             onChange={(_, newValue) => setLocation(newValue || '')}
             renderInput={(params) => (
               <TextField
                 {...params}
                 margin="dense"
                 label="Location"
                 type="text"
                 fullWidth
                 variant="outlined"
                 placeholder="Search building, address, or meeting room..."
                 sx={{ mb: 2 }}
                 InputProps={{
                   ...params.InputProps,
                   endAdornment: (
                     <React.Fragment>
                       {locationLoading ? <CircularProgress color="inherit" size={20} /> : null}
                       {params.InputProps.endAdornment}
                     </React.Fragment>
                   ),
                 }}
               />
             )}
          />

          <TextField
            margin="dense"
            label="Description"
            type="text"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            sx={{ mb: 2 }}
          />

          <Autocomplete
            multiple
            freeSolo
            options={allUniqueGuests}
            filterSelectedOptions
            value={participants}
            onChange={(_, newValue) => setParticipants(newValue as string[])}
            inputValue={emailInput}
            onInputChange={(_, newInputValue) => setEmailInput(newInputValue)}
            renderTags={(value: readonly string[], getTagProps) =>
              value.map((option: string, index: number) => {
                const { key, ...tagProps } = getTagProps({ index });
                return <Chip variant="outlined" label={option} key={key} {...tagProps} />;
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                label="Guests (Emails)"
                placeholder="Type email and press enter"
              />
            )}
            sx={{ mb: 2 }}
          />

          {/* Notifications Section */}
          <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'grey.200', borderRadius: 1 }}>
             <FormControlLabel
                control={<Switch checked={customNotification} onChange={e => setCustomNotification(e.target.checked)} />}
                label={<Typography fontWeight="medium">Custom Notification</Typography>}
                sx={{ mb: customNotification ? 2 : 0 }}
             />
             {customNotification && (
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                   <FormControl size="small" sx={{ minWidth: 120 }}>
                     <InputLabel>Method</InputLabel>
                     <Select value={notificationMethod} onChange={e => setNotificationMethod(e.target.value)} label="Method">
                        <MenuItem value="popup">Notification</MenuItem>
                        <MenuItem value="email">Email</MenuItem>
                     </Select>
                   </FormControl>
                   <TextField 
                     type="number"
                     size="small"
                     label="Minutes before"
                     value={notificationMinutes}
                     onChange={e => setNotificationMinutes(parseInt(e.target.value) || 0)}
                     sx={{ width: 120 }}
                   />
                </Box>
             )}
          </Box>

          {!isEditing && linkedAccounts.length > 0 ? (
            <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
              <InputLabel id="select-account-label">Linked Account</InputLabel>
              <Select
                labelId="select-account-label"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                label="Linked Account"
                required
              >
                {linkedAccounts.map((acc: any) => (
                  <MenuItem key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : !isEditing && (
             <Alert severity="warning" sx={{ mb: 2 }}>Connect Google Calendar before creating events.</Alert>
          )}

          {(!isEditing && linkedAccounts.length > 0) || (isEditing && !existingEvent?.meet_link && existingEvent?.source === 'google') ? (
            <FormControlLabel
              control={<Switch checked={createMeet} onChange={e => setCreateMeet(e.target.checked)} />}
              label="Add Google Meet video conferencing"
            />
          ) : null}

        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading} startIcon={loading ? <CircularProgress size={20} /> : undefined}>
            {isEditing ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
