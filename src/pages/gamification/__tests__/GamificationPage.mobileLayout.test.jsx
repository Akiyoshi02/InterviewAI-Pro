import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GamificationPage from '../index.jsx';
import apiClient from '../../../services/apiClient.js';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockUseMaintenanceMode = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('framer-motion', () => {
  const MotionTag = ({
    children,
    variants,
    initial,
    animate,
    exit,
    transition,
    whileHover,
    whileTap,
    whileInView,
    viewport,
    ...props
  }) => <div {...props}>{children}</div>;

  return {
    motion: new Proxy({}, { get: () => MotionTag }),
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

vi.mock('../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../hooks/useMaintenanceMode', () => ({
  useMaintenanceMode: () => mockUseMaintenanceMode(),
}));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    interviews: {
      getMyInterviews: vi.fn(),
      getScoreLeaderboard: vi.fn(),
    },
    referrals: {
      getLeaderboard: vi.fn(),
    },
  },
}));

vi.mock('../../../components/ui/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('../../../components/ui/UserContextNavigation', () => ({
  default: () => <div>UserContextNavigation</div>,
}));

vi.mock('../../../components/ui/MaintenanceBanner', () => ({
  default: () => <div>MaintenanceBanner</div>,
}));

vi.mock('../../../components/AppIcon', () => ({
  default: ({ name }) => <span data-testid={`icon-${name || 'unknown'}`} />,
}));

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, className, onClick, disabled, type = 'button' }) => (
    <button type={type} className={className} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <GamificationPage />
    </MemoryRouter>,
  );

describe('GamificationPage mobile weekly challenges', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseAuth.mockReset();
    mockUseMaintenanceMode.mockReset();
    apiClient.interviews.getMyInterviews.mockReset();
    apiClient.interviews.getScoreLeaderboard.mockReset();
    apiClient.referrals.getLeaderboard.mockReset();
    localStorage.clear();

    mockUseAuth.mockReturnValue({
      user: {
        id: 'candidate-1',
        accountType: 'CANDIDATE',
      },
      logout: vi.fn(),
    });

    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });

    apiClient.interviews.getMyInterviews.mockResolvedValue({
      success: true,
      interviews: [
        {
          id: 'interview-1',
          status: 'COMPLETED',
          overallScore: 84,
          completedAt: '2026-03-01T10:00:00.000Z',
        },
      ],
    });

    apiClient.referrals.getLeaderboard.mockResolvedValue({
      success: true,
      leaderboard: [],
    });

    apiClient.interviews.getScoreLeaderboard.mockResolvedValue({
      success: true,
      leaderboard: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('stacks weekly challenge actions cleanly for mobile layouts', async () => {
    await renderPage();

    const heading = await screen.findByText('Achievements & Progress');
    expect(heading).toBeTruthy();
    const headerGroup = heading.closest('div')?.parentElement;
    expect(headerGroup).not.toBeNull();
    expect(within(headerGroup).getByTestId('icon-Trophy')).toBeTruthy();
    expect(headerGroup.firstElementChild.className).toContain('from-blue-600');
    expect(headerGroup.firstElementChild.className).toContain('to-purple-600');
    expect(await screen.findByText('Weekly Challenges')).toBeTruthy();

    const markDoneButtons = await screen.findAllByRole('button', { name: /Mark done/i });
    expect(markDoneButtons.length).toBeGreaterThan(0);

    const firstActionButton = markDoneButtons[0];
    const actionRow = firstActionButton.parentElement;
    const challengeRow = actionRow?.parentElement;
    const contentRow = challengeRow?.firstElementChild;

    expect(challengeRow).not.toBeNull();
    expect(challengeRow.className).toContain('flex-col');
    expect(challengeRow.className).toContain('sm:flex-row');
    expect(contentRow).not.toBeNull();
    expect(contentRow.className).toContain('items-start');
    expect(contentRow.className).toContain('flex-1');
    expect(actionRow).not.toBeNull();
    expect(actionRow.className).toContain('w-full');
    expect(actionRow.className).toContain('justify-between');
    expect(actionRow.className).toContain('sm:w-auto');
    expect(firstActionButton.className).toContain('min-w-[96px]');
  });

  it('renders real leaderboard sections without unfinished copy', async () => {
    await renderPage();

    const leaderboardTab = await screen.findByRole('button', { name: /leaderboard/i });
    leaderboardTab.click();

    expect(await screen.findByText('Referral Points')).toBeTruthy();
    expect(await screen.findByText('Interview Scores')).toBeTruthy();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });
});
