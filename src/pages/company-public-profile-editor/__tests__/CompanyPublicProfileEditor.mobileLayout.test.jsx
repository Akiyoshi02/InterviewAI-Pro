import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CompanyPublicProfileEditorPage from '../index.jsx';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockUseMaintenanceMode = vi.fn();
const mockGetAccessToken = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial, animate, transition, ...props }) => <div {...props}>{children}</div>,
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

vi.mock('../../../config/firebase.js', () => ({
  authHelpers: {
    getAccessToken: (...args) => mockGetAccessToken(...args),
  },
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
  default: ({ name, className }) => <span data-testid={`icon-${name || 'unknown'}`} className={className} />,
}));

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, className = '', variant, size, iconName, loading, ...props }) => (
    <button className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock('../../../components/company/CompanyDirectoryProfilePreview', () => ({
  default: () => <div>CompanyDirectoryProfilePreview</div>,
}));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    auth: {
      updateCompanyLogo: vi.fn(),
      updateCompanyCover: vi.fn(),
    },
  },
}));

const buildUser = () => ({
  accountType: 'COMPANY',
  companyName: 'Acme Labs',
  companyLogoUrl: '',
  organizationContext: {
    membership: {
      role: 'ADMIN',
    },
    organization: {
      name: 'Acme Labs',
      branding: {},
    },
  },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <CompanyPublicProfileEditorPage />
    </MemoryRouter>,
  );

describe('CompanyPublicProfileEditor mobile header layout', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseAuth.mockReset();
    mockUseMaintenanceMode.mockReset();
    mockGetAccessToken.mockReset();
    global.fetch = vi.fn();

    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: buildUser(),
      logout: vi.fn(),
      setAuthenticatedUser: vi.fn(),
    });
    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });
    mockGetAccessToken.mockResolvedValue('token-123');
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        companyProfile: {
          tagline: 'Build with confidence',
          location: 'Colombo',
          benefits: '',
          techStack: '',
          socialLinks: {},
        },
      }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    delete global.fetch;
  });

  it('uses the standardized public profile header icon layout', async () => {
    renderPage();

    const heading = await screen.findByRole('heading', { level: 1, name: 'Public Company Profile' });
    const textGroup = heading.closest('div');
    const headerContent = textGroup?.parentElement;
    const headerRow = headerContent?.parentElement;
    const iconWrapper = within(headerRow).getByTestId('icon-Building2').parentElement;
    const previewButton = within(headerRow).getByRole('button', { name: /preview/i });
    const subtitle = screen.getByText('Design how your company appears to candidates in the directory.');

    expect(textGroup).not.toBeNull();
    expect(textGroup.className).toContain('min-w-0');
    expect(headerRow).not.toBeNull();
    expect(headerRow.className).toContain('flex-col');
    expect(headerRow.className).toContain('sm:flex-row');
    expect(iconWrapper).not.toBeNull();
    expect(iconWrapper.className).toContain('shrink-0');
    expect(iconWrapper.className).toContain('p-3');
    expect(subtitle.className).toContain('mt-1');
    expect(previewButton.className).toContain('w-full');
    expect(previewButton.className).toContain('sm:w-auto');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('stacks the company basics settings action below the copy on mobile', async () => {
    renderPage();

    const cardTitle = await screen.findByText('Company basics (managed in Settings)');
    const headerRow = cardTitle.closest('div.min-w-0')?.parentElement;
    const settingsButton = within(headerRow).getByRole('button', { name: /open settings/i });
    const websiteRow = screen.getByText(/website:/i).closest('p');

    expect(headerRow).not.toBeNull();
    expect(headerRow.className).toContain('flex-col');
    expect(headerRow.className).toContain('sm:flex-row');
    expect(settingsButton.className).toContain('w-full');
    expect(settingsButton.className).toContain('sm:w-auto');
    expect(websiteRow).not.toBeNull();
    expect(websiteRow.className).toContain('break-all');
  });

  it('uses a right-aligned custom chevron for the work model select', async () => {
    renderPage();

    const workModelSelect = await screen.findByDisplayValue('Select work model');
    const selectWrapper = workModelSelect.parentElement;
    const chevronIcon = within(selectWrapper).getByTestId('icon-ChevronDown');

    expect(selectWrapper).not.toBeNull();
    expect(workModelSelect.className).toContain('appearance-none');
    expect(workModelSelect.className).toContain('pr-10');
    expect(chevronIcon.className).toContain('absolute');
    expect(chevronIcon.className).toContain('right-3');
    expect(chevronIcon.className).toContain('pointer-events-none');
  });
});
