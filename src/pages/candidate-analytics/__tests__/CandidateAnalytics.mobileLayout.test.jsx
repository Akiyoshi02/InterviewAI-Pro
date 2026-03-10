import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CandidateAnalyticsPage from '../index.jsx';
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
    whileInView,
    whileHover,
    whileTap,
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
      getCandidateFullAnalytics: vi.fn(),
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

vi.mock('recharts', () => ({
  LineChart: ({ children }) => <div data-testid="mock-line-chart">{children}</div>,
  Line: () => null,
  XAxis: ({ hide }) => <div data-testid="mock-x-axis" data-hide={hide ? 'true' : 'false'} />,
  YAxis: () => <div data-testid="mock-y-axis" />,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }) => <div data-testid="mock-responsive-container">{children}</div>,
  BarChart: ({ children, margin }) => (
    <div
      data-testid="mock-bar-chart"
      data-margin-bottom={margin?.bottom?.toString?.() ?? ''}
      data-margin-left={margin?.left?.toString?.() ?? ''}
    >
      {children}
    </div>
  ),
  Bar: ({ children, barSize }) => <div data-testid="mock-bar" data-bar-size={barSize?.toString?.() ?? ''}>{children}</div>,
  Cell: () => null,
  RadarChart: ({ children }) => <div data-testid="mock-radar-chart">{children}</div>,
  Radar: () => null,
  PolarGrid: () => null,
  PolarAngleAxis: () => null,
  PolarRadiusAxis: () => null,
  Legend: () => null,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <CandidateAnalyticsPage />
    </MemoryRouter>,
  );

describe('CandidateAnalyticsPage mobile role breakdown', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseAuth.mockReset();
    mockUseMaintenanceMode.mockReset();
    apiClient.interviews.getCandidateFullAnalytics.mockReset();

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });

    mockUseAuth.mockReturnValue({
      user: {
        id: 'candidate-1',
        accountType: 'CANDIDATE',
      },
      logout: vi.fn(),
    });

    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });

    apiClient.interviews.getCandidateFullAnalytics.mockResolvedValue({
      success: true,
      analytics: {
        trend: [{ label: '1', score: 7 }],
        skillAverages: { technical: 12, communication: 18, overall: 7 },
        roleBreakdown: [
          {
            role: 'Account Test - Talent Acquisition Associate 1772688268885 Reviewer QA',
            count: 1,
            avgScore: 7,
          },
        ],
        weeklyFrequency: [{ label: 'Week 1', sessions: 1 }],
        totalSessions: 1,
        improvementDelta: 0,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('uses a compact chart and wrapped role summaries on mobile widths', async () => {
    renderPage();

    const heading = await screen.findByText('My Analytics');
    const headerGroup = heading.closest('div')?.parentElement;
    expect(headerGroup).not.toBeNull();
    expect(within(headerGroup).getByTestId('icon-BarChart3')).toBeTruthy();
    expect(headerGroup.firstElementChild.className).toContain('from-blue-600');
    expect(headerGroup.firstElementChild.className).toContain('to-purple-600');
    expect(await screen.findByText('Performance by Role')).toBeTruthy();

    const summaryList = screen.getByRole('list', { name: 'Role performance summary' });
    expect(summaryList.className).toContain('grid');
    expect(summaryList.className).toContain('gap-2');

    const [summaryItem] = within(summaryList).getAllByRole('listitem');
    expect(summaryItem.className).toContain('rounded-xl');
    expect(summaryItem.className).toContain('break-words');
    expect(summaryItem.textContent).toContain('Account Test - Talent Acquisition Associate');

    const xAxes = screen.getAllByTestId('mock-x-axis');
    expect(xAxes.some((axis) => axis.dataset.hide === 'true')).toBe(true);

    const barCharts = screen.getAllByTestId('mock-bar-chart');
    expect(barCharts.some((chart) => chart.dataset.marginBottom === '8')).toBe(true);

    const bars = screen.getAllByTestId('mock-bar');
    expect(bars.some((bar) => bar.dataset.barSize === '32')).toBe(true);
  });
});
