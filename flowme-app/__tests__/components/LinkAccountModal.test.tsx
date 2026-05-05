import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LinkAccountModal from '@/components/calendar/LinkAccountModal';
import { ThemeProvider } from '@mui/material/styles';
import theme from '@/lib/theme';

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

const Wrapper = ({ children }: any) => (
  <ThemeProvider theme={theme}>
    {children}
  </ThemeProvider>
);

describe('LinkAccountModal', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('validates name input and submits', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true })
    });

    const onSuccess = jest.fn();
    render(<LinkAccountModal open={true} onClose={jest.fn()} onSuccess={onSuccess} />, { wrapper: Wrapper });

    const nameInput = screen.getByLabelText(/Account Nickname/i);
    const submitBtn = screen.getByRole('button', { name: /Link Account/i });

    // Fill out form
    fireEvent.change(nameInput, { target: { value: 'My Acc' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/linked-accounts', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'My Acc', type: 'personal' })
      }));
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
