import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DashboardQuickActions from '../DashboardQuickActions.jsx';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('DashboardQuickActions', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('routes candidate quick actions to expected pages', () => {
    render(<DashboardQuickActions userType="candidate" stats={{}} />);

    const startButtons = screen.getAllByRole('button', { name: 'Start' });
    expect(startButtons).toHaveLength(3);

    fireEvent.click(startButtons[0]);
    expect(mockNavigate).toHaveBeenLastCalledWith('/practice-interview-setup');

    fireEvent.click(startButtons[1]);
    expect(mockNavigate).toHaveBeenLastCalledWith('/jobs');

    fireEvent.click(startButtons[2]);
    expect(mockNavigate).toHaveBeenLastCalledWith('/candidate-dashboard#recent-activity');
  });

  it('renders total practice time from candidate stats when available', () => {
    render(<DashboardQuickActions userType="candidate" stats={{ totalPracticeTime: '2h 15m' }} />);

    expect(screen.getByText('2h 15m')).toBeTruthy();
    expect(screen.getAllByText('Total Practice').length).toBeGreaterThan(0);
  });
});
