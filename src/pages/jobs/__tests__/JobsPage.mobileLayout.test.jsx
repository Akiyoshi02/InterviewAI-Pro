import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import JobsPage from '../index.jsx';
import apiClient from '../../../services/apiClient.js';

const mockUseAuth = vi.fn();
const mockUseRealtimePathFeed = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('framer-motion', () => {
  const MotionDiv = ({
    children,
    variants,
    initial,
    animate,
    exit,
    transition,
    whileHover,
    whileTap,
    ...props
  }) => <div {...props}>{children}</div>;

  return {
    motion: {
      div: MotionDiv,
    },
  };
});

vi.mock('../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../hooks/useRealtimePathFeed', () => ({
  useRealtimePathFeed: (...args) => mockUseRealtimePathFeed(...args),
}));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    jobs: {
      listPublic: vi.fn(),
    },
    applications: {
      getMyApplications: vi.fn(),
    },
  },
}));

vi.mock('../../../components/ui/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('../../../components/ui/UserContextNavigation', () => ({
  default: () => <div>UserContextNavigation</div>,
}));

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, className, onClick, disabled, type = 'button' }) => (
    <button type={type} className={className} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('../../../components/AppIcon', () => ({
  default: ({ name }) => <span data-testid={`icon-${name || 'unknown'}`} />,
}));

vi.mock('../../../components/ui/UnifiedFilterPanel', () => ({
  __esModule: true,
  FILTER_DATE_GRID_CLASS: 'filter-date-grid',
  FILTER_GRID_CLASS: 'filter-grid',
  FILTER_SUBPANEL_CLASS: 'filter-subpanel',
  default: ({ children, headerActions, title }) => (
    <div>
      <div>{title}</div>
      {headerActions}
      {children}
    </div>
  ),
  UnifiedFilterSelect: ({ label, value, onChange, options = [] }) => (
    <label>
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={(event) => onChange?.(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
  UnifiedFilterToggleButton: ({ label, onClick }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
  UnifiedSearchField: ({ label, value, onChange, placeholder }) => (
    <label>
      <span>{label}</span>
      <input aria-label={label} value={value} onChange={onChange} placeholder={placeholder} />
    </label>
  ),
  UnifiedTextInput: ({ type = 'text', value, onChange }) => (
    <input type={type} value={value} onChange={onChange} />
  ),
}));

vi.mock('../components/JobApplicationForm.jsx', () => ({
  default: () => <div>JobApplicationForm</div>,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <JobsPage />
    </MemoryRouter>,
  );

describe('JobsPage mobile job cards', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseRealtimePathFeed.mockReset();
    mockUseAuth.mockReset();
    apiClient.jobs.listPublic.mockReset();
    apiClient.applications.getMyApplications.mockReset();
    localStorage.clear();

    const expiresAt = new Date(Date.now() + (33 * 24 * 60 * 60 * 1000)).toISOString();

    mockUseAuth.mockReturnValue({
      user: {
        id: 'candidate-1',
        accountType: 'CANDIDATE',
      },
      logout: vi.fn(),
      isAuthenticated: true,
      status: 'authenticated',
    });

    apiClient.jobs.listPublic.mockResolvedValue({
      success: true,
      jobs: [
        {
          id: 'job-1',
          title: 'Account Test - Talent Acquisition Associate1772688268885',
          organization: {
            name: 'Cynectex',
            logo: '/uploads/cynectex-logo.png',
          },
          location: 'Colombo, Sri Lanka (On-site)',
          employmentType: 'FULL_TIME',
          expiresAt,
          publishedAt: new Date(Date.now() - (6 * 24 * 60 * 60 * 1000)).toISOString(),
        },
      ],
    });

    apiClient.applications.getMyApplications.mockResolvedValue({
      success: true,
      applications: [
        {
          jobId: 'job-1',
          status: 'SUBMITTED',
          withdrawnBy: null,
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps long applied cards readable in mobile layouts', async () => {
    renderPage();

    const title = await screen.findByRole('heading', {
      name: /Account Test - Talent Acquisition Associate1772688268885/i,
    });

    const titleRow = title.parentElement;
    const jobCard = title.closest('.card-base');
    expect(titleRow).not.toBeNull();
    expect(jobCard).not.toBeNull();
    expect(titleRow.className).toContain('items-start');
    expect(titleRow.className).toContain('justify-between');
    expect(title.className).toContain('flex-1');
    expect(title.className).toContain('break-words');

    const logoImage = screen.getByAltText('Cynectex');
    const logoFrame = logoImage.parentElement;
    expect(logoFrame).not.toBeNull();
    expect(logoFrame.className).toContain('h-16');
    expect(logoFrame.className).toContain('w-16');
    expect(logoFrame.className).toContain('xs:h-20');

    const locationText = screen.getByText('Colombo, Sri Lanka (On-site)');
    const locationRow = locationText.closest('div');
    const metadataStack = locationRow?.parentElement;
    expect(metadataStack).not.toBeNull();
    expect(metadataStack.className).toContain('flex-col');
    expect(metadataStack.className).toContain('sm:flex-row');
    expect(locationRow.className).toContain('items-start');
    expect(locationText.className).toContain('break-words');
    expect(within(metadataStack).getByText('Full-time').className).toContain('break-words');

    const appliedText = within(jobCard).getByText('Applied');
    const statusRow = appliedText.closest('div')?.parentElement;
    const statusColumn = statusRow?.parentElement;
    expect(statusRow).not.toBeNull();
    expect(statusRow.className).toContain('justify-start');
    expect(statusRow.className).toContain('sm:justify-end');
    expect(statusColumn).not.toBeNull();
    expect(statusColumn.className).toContain('w-full');
    expect(statusColumn.className).toContain('items-start');
    expect(statusColumn.className).toContain('sm:items-end');

    expect(within(jobCard).getByText('33 days left')).toBeTruthy();
  });
});
