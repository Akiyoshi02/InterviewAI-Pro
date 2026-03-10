import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReferralProgramPage from '../index.jsx';
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
    referrals: {
      getMyReferral: vi.fn(),
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
  default: ({ name, className }) => <span data-testid={`icon-${name || 'unknown'}`} className={className} />,
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
      <ReferralProgramPage />
    </MemoryRouter>,
  );

describe('ReferralProgramPage mobile tier layout', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseAuth.mockReset();
    mockUseMaintenanceMode.mockReset();
    apiClient.referrals.getMyReferral.mockReset();
    apiClient.referrals.getLeaderboard.mockReset();

    mockUseAuth.mockReturnValue({
      user: {
        id: 'candidate-1',
        accountType: 'CANDIDATE',
      },
      logout: vi.fn(),
    });

    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });

    apiClient.referrals.getMyReferral.mockResolvedValue({
      success: true,
      referral: {
        tier: 'none',
        totalReferrals: 0,
        completedReferrals: 0,
        totalPoints: 0,
        redeemedPoints: 0,
        referralLink: 'https://example.com/ref/candidate-1',
        code: 'REF123',
      },
      referred: [],
    });

    apiClient.referrals.getLeaderboard.mockResolvedValue({
      success: true,
      leaderboard: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('stacks tier progress and tier cards cleanly for mobile layouts', async () => {
    renderPage();

    const heading = await screen.findByText('Referral Program');
    const headerGroup = heading.closest('div')?.parentElement;
    expect(headerGroup).not.toBeNull();
    expect(within(headerGroup).getByTestId('icon-Gift')).toBeTruthy();
    expect(headerGroup.firstElementChild.className).toContain('from-blue-600');
    expect(headerGroup.firstElementChild.className).toContain('to-purple-600');

    expect(await screen.findByText('Your Tier')).toBeTruthy();

    const progressLabel = screen.getByText('Progress to Bronze');
    expect(progressLabel.parentElement.className).toContain('flex-col');
    expect(progressLabel.parentElement.className).toContain('xs:flex-row');

    const tierList = screen.getByRole('list', { name: 'Tier milestones' });
    expect(tierList.className).toContain('grid-cols-1');
    expect(tierList.className).toContain('xs:grid-cols-2');
    expect(tierList.className).toContain('sm:grid-cols-3');

    const tierItems = within(tierList).getAllByRole('listitem');
    expect(tierItems).toHaveLength(3);
    tierItems.forEach((item) => {
      expect(item.className).toContain('rounded-xl');
      expect(item.className).toContain('p-4');
    });
  });
});
