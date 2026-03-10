import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CompanySettingsPage from '../index.jsx';

const mockUseAuth = vi.fn();
const mockUseMaintenanceMode = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
    section: ({ children, ...props }) => <section {...props}>{children}</section>,
  },
}));

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

vi.mock('../../../components/ui/ProfileSettingsPanel', () => ({
  default: ({ userType }) => <div>{`ProfileSettingsPanel ${userType}`}</div>,
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

const buildCompanyUser = (role) => ({
  accountType: 'COMPANY',
  organizationContext: {
    membership: {
      role,
    },
  },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <CompanySettingsPage />
    </MemoryRouter>,
  );

describe('CompanySettingsPage role copy', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseMaintenanceMode.mockReset();
    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: buildCompanyUser('RECRUITER'),
      logout: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows recruiter-specific settings guidance', () => {
    renderPage();

    const heading = screen.getByText('Settings');
    const textGroup = heading.closest('div');
    const headerRow = textGroup?.parentElement;

    expect(textGroup).not.toBeNull();
    expect(textGroup.className).toContain('min-w-0');
    expect(headerRow).not.toBeNull();
    expect(headerRow.className).toContain('items-center');
    expect(headerRow.className).toContain('gap-4');
    expect(screen.getByTestId('icon-Settings')).toBeTruthy();
    expect(screen.getByText('Manage your recruiter profile, notifications, and interview availability.')).toBeTruthy();
    expect(screen.getByText('ProfileSettingsPanel company')).toBeTruthy();
  });

  it('shows reviewer-specific settings guidance', () => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: buildCompanyUser('REVIEWER'),
      logout: vi.fn(),
    });

    renderPage();

    expect(screen.getByText('Manage your reviewer profile, alerts, and account preferences.')).toBeTruthy();
    expect(screen.getByText('ProfileSettingsPanel company')).toBeTruthy();
  });
});
