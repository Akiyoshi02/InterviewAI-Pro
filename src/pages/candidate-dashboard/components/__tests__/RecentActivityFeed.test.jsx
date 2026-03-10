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
    vi.useRealTimers();
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

  it('stacks completed activity metadata cleanly for mobile layouts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-08T11:00:00.000Z'));

    render(
      <MemoryRouter>
        <RecentActivityFeed
          activities={[
            {
              id: 'int_2',
              status: 'COMPLETED',
              company: { companyName: 'Recruiter UI Test' },
              jobRole: 'Account Test - Talent Acquisition Associate',
              overallScore: 7,
              createdAt: '2026-03-07T12:00:00.000Z',
              feedback: { summary: 'Candidate completed the interview. Awaiting reviewer feedback.' },
            },
          ]}
        />
      </MemoryRouter>,
    );

    const title = screen.getByText(/Completed Account Test - Talent Acquisition Associate Interview/i);
    const timestamp = screen.getByText('23h ago');
    const viewResults = screen.getByRole('button', { name: 'View results' });
    const detailsGroup = screen.getByText('Score: 7%').parentElement;
    const contentStack = title.closest('div')?.parentElement;

    expect(contentStack?.className || '').toContain('flex-col');
    expect(contentStack?.className || '').toContain('sm:flex-row');
    expect(title.className).toContain('sm:line-clamp-2');
    expect(detailsGroup?.className || '').toContain('flex-col');
    expect(detailsGroup?.className || '').toContain('sm:flex-row');
    expect(viewResults.className).toContain('self-start');
    expect(timestamp.className).toContain('self-start');
    expect(timestamp.className).toContain('sm:self-auto');
  });

  it('prefers the interview organization over the assigned recruiter summary in completed activity descriptions', () => {
    render(
      <MemoryRouter>
        <RecentActivityFeed
          activities={[
            {
              id: 'int_3',
              status: 'COMPLETED',
              company: { fullName: 'Recruiter UI Test' },
              organization: { displayName: 'Cynectex' },
              jobRole: 'Account Test - Data Analyst',
              overallScore: 82,
              createdAt: '2026-03-06T10:43:34.000Z',
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Cynectex - Score: 82%')).toBeTruthy();
    expect(screen.queryByText(/Recruiter UI Test/i)).toBeNull();
  });
});
