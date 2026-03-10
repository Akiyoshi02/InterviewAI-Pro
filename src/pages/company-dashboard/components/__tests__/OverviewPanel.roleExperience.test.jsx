import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import OverviewPanel from '../OverviewPanel.jsx';

vi.mock('../../../../components/AppIcon', () => ({
  default: ({ name }) => <span>{name}</span>,
}));

describe('OverviewPanel role experience', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows reviewer-specific review summary cards instead of job visibility cards', () => {
    render(
      <OverviewPanel
        roleVariant="reviewer"
        pendingReviews={2}
        upcomingInterviews={1}
        interviewsToday={1}
        completedReviews={3}
      />,
    );

    expect(screen.getByText('Pending Reviews')).toBeTruthy();
    expect(screen.getByText('Upcoming Interviews')).toBeTruthy();
    expect(screen.getByText('Completed Reviews')).toBeTruthy();
    expect(screen.queryByText('Open Roles')).toBeNull();
  });
});
