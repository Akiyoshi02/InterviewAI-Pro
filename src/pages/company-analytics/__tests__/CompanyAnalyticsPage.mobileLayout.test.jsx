import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CompanyAnalyticsPage from '../index.jsx';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockUseMaintenanceMode = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
    section: ({ children, ...props }) => <section {...props}>{children}</section>,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../hooks/useMaintenanceMode', () => ({
  useMaintenanceMode: () => mockUseMaintenanceMode(),
}));

vi.mock('../../../components/ui/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('../../../components/ui/UserContextNavigation', () => ({
  default: () => <div>User Context Navigation</div>,
}));

vi.mock('../../../components/ui/MaintenanceBanner', () => ({
  default: () => <div>MaintenanceBanner</div>,
}));

vi.mock('../../../components/AppIcon', () => ({
  default: ({ name }) => <span data-testid={`icon-${name || 'unknown'}`} />,
}));

vi.mock('../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock('../../company-dashboard/components/CandidateProgressDashboard', () => ({
  default: () => <div>CandidateProgressDashboard</div>,
}));

const buildCompanyUser = () => ({
  accountType: 'COMPANY',
  organizationContext: {
    membership: {
      role: 'RECRUITER',
    },
  },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <CompanyAnalyticsPage />
    </MemoryRouter>,
  );

describe('CompanyAnalyticsPage mobile header layout', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseAuth.mockReset();
    mockUseMaintenanceMode.mockReset();

    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: buildCompanyUser(),
      logout: vi.fn(),
    });
    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('uses the standardized analytics header icon layout', () => {
    renderPage();

    const heading = screen.getByText('Analytics Dashboard');
    const textGroup = heading.closest('div');
    const headerRow = textGroup?.parentElement;
    const iconWrapper = screen.getByTestId('icon-BarChart3').parentElement;
    const subtitle = screen.getByText('Track candidate progress, hiring metrics, and performance analytics.');

    expect(textGroup).not.toBeNull();
    expect(textGroup.className).toContain('min-w-0');
    expect(headerRow).not.toBeNull();
    expect(headerRow.className).toContain('items-center');
    expect(headerRow.className).toContain('gap-4');
    expect(iconWrapper).not.toBeNull();
    expect(iconWrapper.className).toContain('shrink-0');
    expect(iconWrapper.className).toContain('p-3');
    expect(subtitle.className).toContain('mt-1');
    expect(screen.getByText('CandidateProgressDashboard')).toBeTruthy();
  });
});
