import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CalendarPage from '@/app/app/calendar/page';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import theme from '@/lib/theme';

// Mock fetch
global.fetch = jest.fn((url: string) => {
  if (url.includes('/api/linked-accounts')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ ok: true, accounts: [] })
    });
  }
  if (url.includes('/api/calendar/events')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ ok: true, events: [] })
    });
  }
  return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
}) as jest.Mock;

const Wrapper = ({ children }: any) => (
  <ThemeProvider theme={theme}>
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      {children}
    </LocalizationProvider>
  </ThemeProvider>
);

describe('CalendarPage', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('renders filters and "+" button', async () => {
    render(<CalendarPage />, { wrapper: Wrapper });

    await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
        expect(screen.getByLabelText('Microactivities')).toBeInTheDocument();
    });
    
    // "+" Fab button has AddIcon, verify it's there
    const fabButton = screen.getByRole('button', { name: '' }); 
    expect(fabButton).toBeInTheDocument();
  });
});
