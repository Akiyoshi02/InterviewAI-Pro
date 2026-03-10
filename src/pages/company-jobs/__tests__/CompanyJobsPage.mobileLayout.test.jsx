import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CompanyJobsPage from '../index.jsx';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockGetOrganizationJobs = vi.fn();
const mockCreateJob = vi.fn();
const mockUpdateJob = vi.fn();
const mockUploadAdvertImage = vi.fn();
const mockUploadAdvertVideo = vi.fn();
const mockGetStructuredCatalog = vi.fn();
const mockUseRealtimePathFeed = vi.fn();
const mockHasPermission = vi.fn();

vi.mock('framer-motion', () => {
  const createMotionComponent = (tag) => ({ children, ...props }) => React.createElement(tag, props, children);
  return {
    motion: new Proxy(
      {},
      {
        get: (_target, tag) => createMotionComponent(tag),
      },
    ),
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

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

vi.mock('../../../components/ui/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('../../../components/ui/UserContextNavigation', () => ({
  default: () => <div>User Context Navigation</div>,
}));

vi.mock('../../../components/AppIcon', () => ({
  default: ({ name, className }) => <span data-testid={`icon-${name || 'unknown'}`} className={className} />,
}));

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, className = '', loading, ...props }) => (
    <button className={className} data-loading={loading ? 'true' : 'false'} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../../components/ui/Input', () => ({
  default: ({ className = '', ...props }) => <input className={className} {...props} />,
}));

vi.mock('../../../components/ui/Select', () => ({
  default: ({ className = '', label, options = [], value, onChange, ...props }) => (
    <label>
      {label ? <span>{label}</span> : null}
      <select className={className} value={value} onChange={(event) => onChange?.(event.target.value)} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));

vi.mock('../../../components/ui/LoadingIndicator', () => ({
  default: () => <div>LoadingIndicator</div>,
}));

vi.mock('../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock('../../../components/ui/UnifiedFilterPanel', () => ({
  default: ({ title, description, headerActions, children }) => (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
      {headerActions}
      {children}
    </section>
  ),
  FILTER_DATE_GRID_CLASS: 'filter-date-grid',
  FILTER_GRID_CLASS: 'filter-grid',
  FILTER_SUBPANEL_CLASS: 'filter-subpanel',
  UnifiedFilterSelect: ({ label, options = [], value, onChange }) => (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange?.(event.target.value)}>
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
  UnifiedSearchField: ({ label, ...props }) => (
    <label>
      <span>{label}</span>
      <input {...props} />
    </label>
  ),
  UnifiedTextInput: (props) => <input {...props} />,
}));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    jobs: {
      getOrganizationJobs: (...args) => mockGetOrganizationJobs(...args),
      create: (...args) => mockCreateJob(...args),
      update: (...args) => mockUpdateJob(...args),
      uploadAdvertImage: (...args) => mockUploadAdvertImage(...args),
      uploadAdvertVideo: (...args) => mockUploadAdvertVideo(...args),
    },
    templates: {
      getStructuredCatalog: (...args) => mockGetStructuredCatalog(...args),
    },
  },
}));

vi.mock('../../../hooks/useRealtimePathFeed', () => ({
  useRealtimePathFeed: (...args) => mockUseRealtimePathFeed(...args),
}));

vi.mock('../../../utils/rolePermissions', () => ({
  hasPermission: (...args) => mockHasPermission(...args),
}));

vi.mock('../../../components/ui/ApplicationFormBuilder', () => ({
  default: () => <div>ApplicationFormBuilder</div>,
}));

const buildAuthState = () => ({
  status: 'authenticated',
  logout: vi.fn(),
  refresh: vi.fn(),
  organizationContext: {
    organization: {
      id: 'org-1',
      name: 'Acme Labs',
      status: 'ACTIVE',
    },
    membership: {
      role: 'RECRUITER',
    },
  },
  user: {
    accountType: 'COMPANY',
    organizationContext: {
      organization: {
        id: 'org-1',
        name: 'Acme Labs',
        status: 'ACTIVE',
      },
      membership: {
        role: 'RECRUITER',
      },
    },
  },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <CompanyJobsPage />
    </MemoryRouter>,
  );

describe('CompanyJobsPage mobile header layout', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseAuth.mockReset();
    mockGetOrganizationJobs.mockReset();
    mockCreateJob.mockReset();
    mockUpdateJob.mockReset();
    mockUploadAdvertImage.mockReset();
    mockUploadAdvertVideo.mockReset();
    mockGetStructuredCatalog.mockReset();
    mockUseRealtimePathFeed.mockReset();
    mockHasPermission.mockReset();

    mockUseAuth.mockReturnValue(buildAuthState());
    mockGetOrganizationJobs.mockResolvedValue({
      success: true,
      jobs: [],
    });
    mockCreateJob.mockResolvedValue({
      success: true,
      job: { id: 'job-1', title: 'Backend Engineer' },
    });
    mockUpdateJob.mockResolvedValue({
      success: true,
      job: { id: 'job-1', title: 'Backend Engineer' },
    });
    mockUploadAdvertImage.mockResolvedValue({ success: true, job: { id: 'job-1' } });
    mockUploadAdvertVideo.mockResolvedValue({ success: true, job: { id: 'job-1' } });
    mockGetStructuredCatalog.mockResolvedValue({
      success: true,
      catalog: {
        templates: [
          {
            id: 'behavioral-core',
            name: 'Behavioral Core',
            source: 'CATALOG',
          },
        ],
      },
    });
    mockHasPermission.mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('uses the standardized mobile header layout for job postings', async () => {
    renderPage();

    const heading = await screen.findByText('Job Postings');
    const textGroup = heading.closest('div');
    const headerContent = textGroup?.parentElement;
    const headerRow = headerContent?.parentElement;
    const iconWrapper = within(headerRow).getByTestId('icon-Briefcase').parentElement;
    const createButton = within(headerRow).getByRole('button', { name: /create job/i });
    const subtitle = screen.getByText('Manage your job listings and track applications.');

    expect(textGroup).not.toBeNull();
    expect(textGroup.className).toContain('min-w-0');
    expect(headerRow).not.toBeNull();
    expect(headerRow.className).toContain('flex-col');
    expect(headerRow.className).toContain('sm:flex-row');
    expect(iconWrapper).not.toBeNull();
    expect(iconWrapper.className).toContain('shrink-0');
    expect(iconWrapper.className).toContain('p-3');
    expect(subtitle.className).toContain('mt-1');
    expect(createButton.className).toContain('w-full');
    expect(createButton.className).toContain('sm:w-auto');

    await waitFor(() => {
      expect(mockGetOrganizationJobs).toHaveBeenCalledTimes(1);
    });
  });

  it('stacks the location detect action below the input on mobile in the job form', async () => {
    renderPage();

    const createButtons = await screen.findAllByRole('button', { name: /create job/i });
    fireEvent.click(createButtons[0]);

    const locationInput = await screen.findByLabelText('Location');
    const locationField = locationInput.closest('div.min-w-0');
    const inputAndButtonGroup = locationInput.parentElement;
    const detectButton = within(locationField).getByRole('button', { name: /detect location/i });

    expect(locationField).not.toBeNull();
    expect(inputAndButtonGroup).not.toBeNull();
    expect(inputAndButtonGroup.className).toContain('flex-col');
    expect(inputAndButtonGroup.className).toContain('sm:block');
    expect(locationInput.className).toContain('min-w-0');
    expect(locationInput.className).toContain('pr-3');
    expect(locationInput.className).toContain('sm:pr-[100px]');
    expect(detectButton.className).toContain('w-full');
    expect(detectButton.className).toContain('min-h-[44px]');
    expect(detectButton.className).toContain('sm:w-auto');
    expect(within(detectButton).getByText('Detect location')).not.toBeNull();
  });

  it('submits a normalized interview plan with the job payload', async () => {
    renderPage();

    const createButtons = await screen.findAllByRole('button', { name: /create job/i });
    fireEvent.click(createButtons[0]);

    fireEvent.change(screen.getByPlaceholderText('e.g. Senior Frontend Developer'), {
      target: { value: 'Platform Engineer' },
    });
    fireEvent.change(screen.getByPlaceholderText('Describe the role, responsibilities, and what you\'re looking for...'), {
      target: { value: 'Own the ATS platform.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^add stage$/i }));
    fireEvent.change(screen.getByDisplayValue('Interview Stage 4'), {
      target: { value: 'Hiring Manager Final' },
    });
    const interviewKitSelects = screen.getAllByLabelText('Interview Kit');
    fireEvent.change(interviewKitSelects.at(-1), {
      target: { value: 'behavioral-core' },
    });

    const submitButton = screen.getAllByRole('button', { name: /^create job$/i }).at(-1);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateJob).toHaveBeenCalledTimes(1);
    });

    const payload = mockCreateJob.mock.calls[0][0];
    expect(payload.templateConfig).toMatchObject({
      duration: 30,
      interviewTypes: ['BEHAVIORAL', 'TECHNICAL'],
    });
    expect(payload.templateConfig.interviewPlan.stages).toHaveLength(4);
    expect(payload.templateConfig.interviewPlan.stages[3]).toMatchObject({
      name: 'Hiring Manager Final',
      category: 'TECHNICAL',
      advanceRule: 'PASS_REQUIRED',
      autoAdvanceOnPass: false,
      autoAdvanceOnComplete: false,
      failDispositionCode: null,
      templateId: 'behavioral-core',
    });
  });
});
