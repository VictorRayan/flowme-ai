import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterPanel from '@/components/calendar/FilterPanel';
import { ThemeProvider } from '@mui/material/styles';
import theme from '@/lib/theme';

const Wrapper = ({ children }: any) => (
  <ThemeProvider theme={theme}>
    {children}
  </ThemeProvider>
);

describe('FilterPanel', () => {
  it('toggles modify filter state', () => {
    const setFilters = jest.fn();
    const filters = {
      showMicroactivities: true,
      showGoogleEvents: true,
      accountIds: [],
      accountTypes: [],
    };

    render(
      <FilterPanel 
        filters={filters} 
        setFilters={setFilters} 
        linkedAccounts={[]} 
        onAddAccount={jest.fn()} 
      />,
      { wrapper: Wrapper }
    );

    const microCheckbox = screen.getByLabelText('Microactivities');
    fireEvent.click(microCheckbox);
    
    expect(setFilters).toHaveBeenCalled();
  });
});
