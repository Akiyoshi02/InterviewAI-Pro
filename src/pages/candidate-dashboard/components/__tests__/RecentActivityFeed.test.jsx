import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RecentActivityFeed from '../RecentActivityFeed.jsx';

vi.mock('../../../../components/ui/Button.jsx', () => ({
  default: ({ children, onClick, disabled, type = 'button' }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('../../../../components/AppIcon.jsx', () => ({
  default: () => <span data-testid="mock-icon" />,
}));

describe('RecentActivityFeed', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('wires view-all and history actions', () => {
    const onViewAll = vi.fn();
    const onViewHistory = vi.fn();

    render(
      <MemoryRouter>
        <RecentActivityFeed
          activities={[
            { id: 'int_1', status: 'COMPLETED', jobRole: 'Backend Engineer', overallScore: 81, createdAt: '2026-02-10T12:00:00.000Z' },
          ]}
          onViewAll={onViewAll}
          onViewHistory={onViewHistory}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View All' }));
    fireEvent.click(screen.getByRole('button', { name: 'View Complete Activity History' }));

    expect(onViewAll).toHaveBeenCalledTimes(1);
    expect(onViewHistory).toHaveBeenCalledTimes(1);
  });

  it('routes empty-state actions to history callback instead of disabling controls', () => {
    const onViewHistory = vi.fn();

    render(
      <MemoryRouter>
        <RecentActivityFeed
          activities={[]}
          onViewHistory={onViewHistory}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Explore Applications' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open My Applications' }));

    expect(onViewHistory).toHaveBeenCalledTimes(2);
  });
});
