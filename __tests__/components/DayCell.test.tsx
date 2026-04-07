import React from 'react';
import { render, screen } from '@testing-library/react';
import DayCell from '@/components/calendar/DayCell';

describe('DayCell', () => {
  it('renders correctly and shows +N more for overflow events', () => {
    const events = [
      { id: '1', title: 'Ev 1', source: 'microactivity', start_at: '2025-01-01' },
      { id: '2', title: 'Ev 2', source: 'google', start_at: '2025-01-01' },
      { id: '3', title: 'Ev 3', source: 'google', start_at: '2025-01-01' },
      { id: '4', title: 'Ev 4', source: 'microactivity', start_at: '2025-01-01' },
      { id: '5', title: 'Ev 5', source: 'google', start_at: '2025-01-01' },
    ] as any;

    render(
      <DayCell 
        date={1} 
        isCurrentMonth={true} 
        isToday={false} 
        events={events} 
        onClick={jest.fn()} 
      />
    );

    // Should only show first 3
    expect(screen.getByText('Ev 1')).toBeInTheDocument();
    expect(screen.getByText('Ev 2')).toBeInTheDocument();
    expect(screen.getByText('Ev 3')).toBeInTheDocument();
    
    // Should NOT show the 4th
    expect(screen.queryByText('Ev 4')).not.toBeInTheDocument();

    // Should show +2 more
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });
});
