import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CompanyCandidatesPage from '../index.jsx';

const mockUseAuth = vi.fn();
const mockUseMaintenanceMode = vi.fn();

vi.mock('framer-motion', () => {
  const MotionDiv = ({ children, ...props }) => <div {...props}>{children}</div>;
  return {
    motion: {
      section: MotionDiv,
      div: MotionDiv,
    },
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
  default: () => <div>UserContextNavigation</div>,
}));

vi.mock('../../../pages/company-dashboard/components/CandidateManager', () => ({
  default: () => <div>CandidateManager</div>,
}));

vi.mock('../../../components/ui/EmailTemplatesManager', () => ({
  default: () => <div>EmailTemplatesManager</div>,
}));

vi.mock('../../../components/ui/MaintenanceBanner', () => ({
  default: () => <div>MaintenanceBanner</div>,
}));

vi.mock('../../../components/AppIcon', () => ({
  default: () => <span data-testid="icon" />,
}));

vi.mock('../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

const buildUser = (role) => ({
  id: `${role.toLowerCase()}-1`,
  accountType: 'COMPANY',
  organizationContext: {
    membership: { role },
  },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <CompanyCandidatesPage />
    </MemoryRouter>,
  );

describe('CompanyCandidatesPage role experience', () => {
  beforeEach(() => {
    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });
    mockUseAuth.mockReturnValue({
      user: buildUser('RECRUITER'),
      logout: vi.fn(),
      status: 'authenticated',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps email template management visible for recruiters', () => {
    renderPage();

    expect(screen.getByText('Candidate Management')).toBeTruthy();
    expect(screen.getByText('CandidateManager')).toBeTruthy();
    expect(screen.getByText('EmailTemplatesManager')).toBeTruthy();
  });

  it('uses the standardized company header layout for candidate management', () => {
    renderPage();

    const heading = screen.getByText('Candidate Management');
    const icon = screen.getByTestId('icon');
    const iconWrapper = icon.parentElement;
    const textWrapper = heading.parentElement;
    const headerRow = textWrapper.parentElement;

    expect(headerRow.className).toContain('mb-6');
    expect(headerRow.className).toContain('flex');
    expect(headerRow.className).toContain('items-center');
    expect(iconWrapper.className).toContain('shrink-0');
    expect(iconWrapper.className).toContain('p-3');
    expect(textWrapper.className).toContain('min-w-0');
  });

  it('switches to read-only copy and hides email template management for reviewers', () => {
    mockUseAuth.mockReturnValue({
      user: buildUser('REVIEWER'),
      logout: vi.fn(),
      status: 'authenticated',
    });

    renderPage();

    expect(screen.getByText('Candidate Profiles')).toBeTruthy();
    expect(
      screen.getByText(/review candidate profiles, resumes, and application context/i),
    ).toBeTruthy();
    expect(screen.getByText('CandidateManager')).toBeTruthy();
    expect(screen.queryByText('EmailTemplatesManager')).toBeNull();
  });
});
