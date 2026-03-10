import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ApplicationsManager from '../ApplicationsManager.jsx';

const mockUseAuth = vi.fn();
const mockUseRealtimePathFeed = vi.fn();

vi.mock('framer-motion', () => {
  const MotionDiv = ({ children, ...props }) => <div {...props}>{children}</div>;
  return {
    motion: {
      div: MotionDiv,
    },
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

vi.mock('../../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../../hooks/useRealtimePathFeed', () => ({
  useRealtimePathFeed: (...args) => mockUseRealtimePathFeed(...args),
}));

vi.mock('../../../../services/apiClient.js', () => ({
  default: {
    organizations: {
      listMembers: vi.fn(),
    },
    applications: {
      getOrganizationApplications: vi.fn(),
      getJobApplications: vi.fn(),
      getApplication: vi.fn(),
      updateStatus: vi.fn(),
      upsertOffer: vi.fn(),
      resendOffer: vi.fn(),
    },
    interviews: {
      schedule: vi.fn(),
    },
    uploads: {
      getDownloadUrl: vi.fn(),
    },
  },
}));

vi.mock('../../../../components/AppIcon', () => ({
  default: ({ name }) => <span>{name || 'Icon'}</span>,
}));

vi.mock('../../../../components/ui/Button', () => ({
  default: ({
    children,
    onClick,
    type = 'button',
    disabled,
    loading,
    iconName: _iconName,
    iconPosition: _iconPosition,
    variant: _variant,
    ...props
  }) => (
    <button type={type} onClick={onClick} disabled={disabled || loading} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock('../../../../components/ui/UnifiedFilterPanel', () => {
  const Panel = ({ children }) => <div>{children}</div>;
  const Select = ({ value, onChange, options = [], label }) => (
    <label>
      {label || 'select'}
      <select value={value} onChange={(event) => onChange?.(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
  const ToggleButton = ({ label, onClick }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  );
  const SearchField = ({ value, onChange, placeholder }) => (
    <input
      aria-label={placeholder || 'search'}
      value={value}
      onChange={(event) => onChange?.(event)}
      placeholder={placeholder}
    />
  );
  const TextInput = ({ type = 'text', value, onChange }) => (
    <input type={type} value={value} onChange={onChange} />
  );
  const FilterField = ({ label, children }) => (
    <label>
      {label}
      {children}
    </label>
  );

  return {
    default: Panel,
    FILTER_DATE_GRID_CLASS: 'filter-date-grid',
    FILTER_GRID_CLASS: 'filter-grid',
    FILTER_SUBPANEL_CLASS: 'filter-subpanel',
    UnifiedFilterField: FilterField,
    UnifiedFilterSelect: Select,
    UnifiedFilterToggleButton: ToggleButton,
    UnifiedSearchField: SearchField,
    UnifiedTextInput: TextInput,
  };
});

import apiClient from '../../../../services/apiClient.js';

const buildApplication = ({
  id = 'application-1',
  status = 'SCREENING',
  interviewId = null,
  offer = undefined,
  offerHistory = undefined,
  onboarding = undefined,
} = {}) => ({
  id,
  status,
  interviewId,
  candidateId: 'candidate-1',
  submittedAt: '2026-03-01T09:00:00.000Z',
  candidate: {
    fullName: 'Aki Yapa',
    email: 'aki@example.com',
    location: 'Colombo',
  },
  job: {
    id: 'job-1',
    title: 'DevOps Engineer',
    department: 'Infrastructure',
    skills: ['Docker', 'AWS'],
  },
  answers: [
    {
      question: 'Why this role?',
      answer: 'I enjoy platform engineering.',
    },
  ],
  ...(offer !== undefined ? { offer } : {}),
  ...(offerHistory !== undefined ? { offerHistory } : {}),
  ...(onboarding !== undefined ? { onboarding } : {}),
});

const renderManager = () => render(
  <MemoryRouter>
    <ApplicationsManager />
  </MemoryRouter>,
);

describe('ApplicationsManager role experience', () => {
  beforeEach(() => {
    mockUseRealtimePathFeed.mockReset();
    mockUseAuth.mockReturnValue({
      organization: { id: 'org-1' },
      user: {
        id: 'recruiter-1',
        organizationContext: {
          membership: { role: 'RECRUITER' },
        },
      },
    });

    apiClient.applications.getOrganizationApplications = vi.fn().mockResolvedValue({
      success: true,
      applications: [buildApplication()],
    });
    apiClient.applications.getJobApplications = vi.fn().mockResolvedValue({
      success: true,
      applications: [buildApplication()],
    });
    apiClient.applications.getApplication = vi.fn().mockResolvedValue({
      success: true,
      application: buildApplication(),
    });
    apiClient.organizations.listMembers = vi.fn().mockResolvedValue({
      success: true,
      members: [
        {
          userId: 'reviewer-1',
          role: 'REVIEWER',
          status: 'ACTIVE',
          user: { id: 'reviewer-1', fullName: 'Reviewer One', email: 'reviewer1@example.com' },
        },
      ],
    });
    apiClient.applications.updateStatus = vi.fn().mockResolvedValue({
      success: true,
    });
    apiClient.applications.upsertOffer = vi.fn().mockResolvedValue({
      success: true,
      message: 'Offer details saved successfully.',
      application: buildApplication({ status: 'OFFER' }),
    });
    apiClient.applications.resendOffer = vi.fn().mockResolvedValue({
      success: true,
      message: 'Offer email resent successfully.',
      application: buildApplication({
        status: 'OFFER',
        offer: {
          title: 'DevOps Engineer Offer',
          compensationAmount: 450000,
          compensationCurrency: 'LKR',
          compensationPeriod: 'MONTHLY',
          startDate: '2026-04-01T00:00:00.000Z',
          expiresAt: '2099-04-15T12:00:00.000Z',
          status: 'PENDING',
        },
        offerHistory: [
          {
            id: 'history-1',
            eventType: 'RESENT',
            createdAt: '2026-03-10T10:00:00.000Z',
            note: 'Offer email was resent to the candidate.',
            offer: {
              title: 'DevOps Engineer Offer',
              compensationAmount: 450000,
              compensationCurrency: 'LKR',
              compensationPeriod: 'MONTHLY',
              status: 'PENDING',
            },
          },
        ],
      }),
    });
    apiClient.interviews.schedule = vi.fn().mockResolvedValue({
      success: true,
    });
    apiClient.uploads.getDownloadUrl = vi.fn().mockResolvedValue('http://localhost/resume.pdf');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps recruiter status controls available in application details', async () => {
    renderManager();

    await screen.findByText(/job applications/i);

    fireEvent.click(screen.getByRole('button', { name: /view/i }));

    await waitFor(() => {
      expect(screen.getByText('Current Status')).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: /screeningcurrent/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^interviewing$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /screening in progress/i })).toBeTruthy();
  });

  it('keeps reviewers read-only but lets them open the linked interview workspace', async () => {
    mockUseAuth.mockReturnValue({
      organization: { id: 'org-1' },
      user: {
        id: 'reviewer-1',
        organizationContext: {
          membership: { role: 'REVIEWER' },
        },
      },
    });

    apiClient.applications.getOrganizationApplications = vi.fn().mockResolvedValue({
      success: true,
      applications: [buildApplication({ status: 'INTERVIEWING', interviewId: 'interview-1' })],
    });

    renderManager();

    await screen.findByText(/application reviews/i);

    fireEvent.click(screen.getByRole('button', { name: /view/i }));

    await waitFor(() => {
      expect(screen.getByText('Current Status')).toBeTruthy();
    });

    expect(screen.queryByRole('button', { name: /screeningcurrent/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /confirm:/i })).toBeNull();
    expect(screen.getByRole('button', { name: /open interview/i })).toBeTruthy();
    expect(
      screen.getByText(/inspect reviews and scheduling details/i),
    ).toBeTruthy();
  });

  it('passes reviewer assignments when moving a candidate to interviewing', async () => {
    renderManager();

    await screen.findByText(/job applications/i);
    fireEvent.click(screen.getByRole('button', { name: /view/i }));

    await waitFor(() => {
      expect(screen.getByText('Current Status')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /^interviewing$/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm: interviewing/i }));

    await waitFor(() => {
      expect(screen.getByText('Move To Interviewing')).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reviewer One/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Reviewer One/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Set Status' }));

    await waitFor(() => {
      expect(apiClient.applications.updateStatus).toHaveBeenCalledWith(
        'application-1',
        expect.objectContaining({
          interviewSchedulingMode: 'AUTO',
          reviewerAssignments: ['reviewer-1'],
          status: 'INTERVIEWING',
        }),
      );
    });
  });

  it('lets recruiters save structured offer details for offer-stage applications', async () => {
    apiClient.applications.getOrganizationApplications = vi.fn().mockResolvedValue({
      success: true,
      applications: [buildApplication({ status: 'OFFER' })],
    });
    apiClient.applications.getApplication = vi.fn().mockResolvedValue({
      success: true,
      application: buildApplication({ status: 'OFFER', offer: null }),
    });

    renderManager();

    await screen.findByText(/job applications/i);
    fireEvent.click(screen.getByRole('button', { name: /view/i }));

    await waitFor(() => {
      expect(screen.getByText('Offer Details')).toBeTruthy();
    });

    fireEvent.change(screen.getByDisplayValue('DevOps Engineer'), {
      target: { value: 'DevOps Engineer Offer' },
    });
    fireEvent.change(screen.getByLabelText('Compensation Amount'), {
      target: { value: '450000' },
    });
    fireEvent.change(screen.getByLabelText('Currency'), {
      target: { value: 'LKR' },
    });
    fireEvent.change(screen.getByLabelText('Start Date'), {
      target: { value: '2026-04-01' },
    });
    fireEvent.change(screen.getByLabelText('Offer Expiry'), {
      target: { value: '2099-04-15T12:00' },
    });

    fireEvent.click(screen.getByRole('button', { name: /save offer details/i }));

    await waitFor(() => {
      expect(apiClient.applications.upsertOffer).toHaveBeenCalledWith(
        'application-1',
        expect.objectContaining({
          title: 'DevOps Engineer Offer',
          compensationAmount: 450000,
          compensationCurrency: 'LKR',
        }),
      );
    });
  });

  it('lets recruiters resend a pending offer email from the offer workspace', async () => {
    const offer = {
      title: 'DevOps Engineer Offer',
      compensationAmount: 450000,
      compensationCurrency: 'LKR',
      compensationPeriod: 'MONTHLY',
      startDate: '2026-04-01T00:00:00.000Z',
      expiresAt: '2099-04-15T12:00:00.000Z',
      sentAt: '2026-03-10T10:00:00.000Z',
      status: 'PENDING',
    };
    apiClient.applications.getOrganizationApplications = vi.fn().mockResolvedValue({
      success: true,
      applications: [buildApplication({ status: 'OFFER', offer })],
    });
    apiClient.applications.getApplication = vi.fn().mockResolvedValue({
      success: true,
      application: buildApplication({ status: 'OFFER', offer }),
    });

    renderManager();

    await screen.findByText(/job applications/i);
    fireEvent.click(screen.getByRole('button', { name: /view/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /resend offer email/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /resend offer email/i }));

    await waitFor(() => {
      expect(apiClient.applications.resendOffer).toHaveBeenCalledWith('application-1');
      expect(screen.getByText(/offer email resent successfully/i)).toBeTruthy();
    });
  });

  it('shows the onboarding workspace entry point for hired applications with onboarding', async () => {
    apiClient.applications.getOrganizationApplications = vi.fn().mockResolvedValue({
      success: true,
      applications: [buildApplication({
        status: 'HIRED',
        offer: { title: 'DevOps Engineer Offer', compensationAmount: 450000, compensationCurrency: 'LKR', compensationPeriod: 'MONTHLY', status: 'ACCEPTED' },
        onboarding: { status: 'IN_PROGRESS', tasks: [{ id: 'task-1', title: 'Confirm details', owner: 'CANDIDATE', status: 'PENDING' }] },
      })],
    });
    apiClient.applications.getApplication = vi.fn().mockResolvedValue({
      success: true,
      application: buildApplication({
        status: 'HIRED',
        offer: { title: 'DevOps Engineer Offer', compensationAmount: 450000, compensationCurrency: 'LKR', compensationPeriod: 'MONTHLY', status: 'ACCEPTED' },
        onboarding: { status: 'IN_PROGRESS', tasks: [{ id: 'task-1', title: 'Confirm details', owner: 'CANDIDATE', status: 'PENDING' }] },
      }),
    });

    renderManager();

    await screen.findByText(/job applications/i);
    fireEvent.click(screen.getByRole('button', { name: /view/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open onboarding workspace/i })).toBeTruthy();
    });
  });
});
