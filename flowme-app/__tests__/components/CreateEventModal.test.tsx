import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateEventModal from '@/components/calendar/CreateEventModal';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import theme from '@/lib/theme';

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

const Wrapper = ({ children }: any) => (
  <ThemeProvider theme={theme}>
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      {children}
    </LocalizationProvider>
  </ThemeProvider>
);

describe('CreateEventModal', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('submits correct payload for event creation', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true })
    });

    const onSuccess = jest.fn();
    const mockAccounts = [{ id: 'acc1', name: 'Work', type: 'work', is_active: true }];

    render(<CreateEventModal open={true} onClose={jest.fn()} onSuccess={onSuccess} linkedAccounts={mockAccounts} />, { wrapper: Wrapper });

    const titleInput = screen.getByLabelText(/Event Name/i);
    const submitBtn = screen.getByRole('button', { name: /Create/i });

    fireEvent.change(titleInput, { target: { value: 'New Test Event' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/calendar/create-event', expect.objectContaining({
        method: 'POST'
      }));
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
