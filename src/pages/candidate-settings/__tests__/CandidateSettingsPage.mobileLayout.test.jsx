import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CandidateSettingsPage from '../index.jsx';

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

const renderPage = () =>
  render(
    <MemoryRouter>
      <CandidateSettingsPage />
    </MemoryRouter>,
  );

describe('CandidateSettingsPage mobile header layout', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseMaintenanceMode.mockReset();

    mockUseAuth.mockReturnValue({
      user: {
        id: 'candidate-1',
        accountType: 'CANDIDATE',
      },
      logout: vi.fn(),
    });

    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps the settings header icon-led and mobile-friendly', () => {
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
    expect(screen.getByText('Manage your profile details, education, links, photo, resume, and preferences.')).toBeTruthy();
    expect(screen.getByText('ProfileSettingsPanel candidate')).toBeTruthy();
  });
});
