import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AchievementBadges from '../AchievementBadges.jsx';

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

describe('AchievementBadges', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('wires leaderboard and view-all actions', () => {
    const onViewLeaderboard = vi.fn();
    const onViewAll = vi.fn();

    render(
      <AchievementBadges
        badges={[
          {
            id: 'badge_1',
            name: 'First Steps',
            description: 'Complete your first interview session',
            icon: 'Award',
            color: 'bg-gradient-to-br from-emerald-500 to-teal-500',
            rarity: 'common',
            earned: true,
            progress: 1,
            total: 1,
            earnedDate: '2026-02-01T12:00:00.000Z',
          },
        ]}
        onViewLeaderboard={onViewLeaderboard}
        onViewAll={onViewAll}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Leaderboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'View All Achievements' }));

    expect(onViewLeaderboard).toHaveBeenCalledTimes(1);
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });
});

