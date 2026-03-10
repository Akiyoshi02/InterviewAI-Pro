import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import CandidateProgressDashboard from '../CandidateProgressDashboard.jsx';

const mockUseAuth = vi.fn();
const mockUseRealtimePathFeed = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, whileHover, whileTap, initial, animate, transition, ...props }) => <div {...props}>{children}</div>,
  },
}));

vi.mock('jspdf', () => ({
  default: class MockJsPdf {},
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  LineChart: ({ children }) => <div>{children}</div>,
  Line: () => <div />,
  BarChart: ({ children }) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

vi.mock('../../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../../hooks/useRealtimePathFeed', () => ({
  useRealtimePathFeed: (...args) => mockUseRealtimePathFeed(...args),
}));

vi.mock('../../../../components/AppIcon', () => ({
  default: ({ name, className }) => <span data-testid={`icon-${name || 'default'}`} className={className} />,
}));

vi.mock('../../../../components/ui/Button', () => ({
  default: ({ children, className, onClick }) => (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('../../../../components/ui/Select', () => ({
  default: ({ className }) => (
    <div data-testid="time-range-select" className={className}>
      Last 30 days
    </div>
  ),
}));

vi.mock('../../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock('../../../../services/apiClient.js', () => ({
  default: {
    applications: {
      getOrganizationApplications: vi.fn(async () => ({ success: true, applications: [] })),
    },
    analytics: {
      getCompanyMetrics: vi.fn(async () => ({ success: true, metrics: {} })),
    },
    jobs: {
      getOrganizationJobs: vi.fn(async () => ({ success: true, jobs: [] })),
    },
  },
}));

describe('CandidateProgressDashboard mobile layout', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: {
        organizationContext: {
          organization: { id: 'org-1' },
        },
      },
    });
    mockUseRealtimePathFeed.mockReturnValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('stacks the header controls below the title on mobile', async () => {
    render(<CandidateProgressDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Candidate Progress Analytics')).toBeTruthy();
    });

    const heading = screen.getByText('Candidate Progress Analytics');
    const titleBlock = heading.parentElement;
    const headerRow = titleBlock.parentElement;
    const controls = titleBlock.nextElementSibling;
    const selectWrapper = screen.getByTestId('time-range-select').parentElement;
    const refreshButton = screen.getByRole('button', { name: /refresh/i });

    expect(headerRow.className).toContain('flex-col');
    expect(headerRow.className).toContain('sm:flex-row');
    expect(titleBlock.className).toContain('min-w-0');
    expect(controls.className).toContain('w-full');
    expect(controls.className).toContain('xs:flex-row');
    expect(controls.className).toContain('sm:w-auto');
    expect(selectWrapper.className).toContain('w-full');
    expect(selectWrapper.className).toContain('xs:w-[160px]');
    expect(refreshButton.className).toContain('w-full');
    expect(refreshButton.className).toContain('xs:w-auto');
  });
});
