import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import QuickActions from '../QuickActions.jsx';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../../components/AppIcon', () => ({
  default: ({ name }) => <span>{name}</span>,
}));

vi.mock('../../../../components/ui/Button', () => ({
  default: ({ children, onClick, className, ...props }) => (
    <button
      type="button"
      onClick={onClick}
      className={className}
      {...Object.fromEntries(Object.entries(props).filter(([key]) => !['iconName', 'iconPosition'].includes(key)))}
    >
      {children}
    </button>
  ),
}));

describe('QuickActions role experience', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('routes recruiter analytics shortcut to the analytics page', () => {
    render(<QuickActions organizationRole="RECRUITER" />);

    fireEvent.click(screen.getByRole('button', { name: /view analytics/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/company-analytics');
  });

  it('shows reviewer-specific shortcut labels and hides analytics', () => {
    render(<QuickActions organizationRole="REVIEWER" />);

    expect(screen.getByRole('button', { name: /open review queue/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /review interview evidence/i })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /assigned reviews/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /assigned candidates/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /view analytics/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /interview settings/i })).toBeNull();
  });
});
