import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CandidateManager from '../CandidateManager.jsx';

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
    applications: {
      getOrganizationApplications: vi.fn(),
    },
    jobs: {
      getOrganizationJobs: vi.fn(),
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

vi.mock('../../../../components/ui/EmailTemplatesManager', () => ({
  default: () => <div>EmailTemplatesManager</div>,
}));

vi.mock('../../../../components/ui/CandidateNotesTimeline', () => ({
  default: () => <div>CandidateNotesTimeline</div>,
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

const buildApplication = () => ({
  id: 'application-1',
  status: 'SCREENING',
  submittedAt: '2026-03-01T09:00:00.000Z',
  candidate: {
    fullName: 'Aki Yapa',
    email: 'aki@example.com',
    experienceLevel: 'Senior',
    skills: ['React', 'Node.js'],
    location: 'Colombo',
  },
  job: {
    title: 'DevOps Engineer',
    skills: ['Docker', 'AWS'],
  },
  coverLetter: 'Strong background in infrastructure.',
  resumeUrl: 'resume-key',
  answers: [
    {
      question: 'Why this role?',
      answer: 'I enjoy platform engineering.',
    },
  ],
});

const renderManager = () => render(<CandidateManager />);

describe('CandidateManager role experience', () => {
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
    apiClient.jobs.getOrganizationJobs = vi.fn().mockResolvedValue({
      success: true,
      jobs: [{ id: 'job-1', title: 'DevOps Engineer' }],
    });
    apiClient.uploads.getDownloadUrl = vi.fn().mockResolvedValue('http://localhost/resume.pdf');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps recruiter management controls available', async () => {
    renderManager();

    await screen.findByText(/candidate pipeline/i);

    expect(screen.getByText(/select all on this page/i)).toBeTruthy();
    expect(screen.getByText(/export all/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /view/i }));

    await waitFor(() => {
      expect(screen.getByText('CandidateNotesTimeline')).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: /send email/i })).toBeTruthy();
  });

  it('removes recruiter-only controls for reviewers while keeping the profile visible', async () => {
    mockUseAuth.mockReturnValue({
      organization: { id: 'org-1' },
      user: {
        id: 'reviewer-1',
        organizationContext: {
          membership: { role: 'REVIEWER' },
        },
      },
    });

    renderManager();

    await screen.findByText(/candidate profiles/i);

    expect(apiClient.jobs.getOrganizationJobs).not.toHaveBeenCalled();

    expect(screen.queryByText(/select all on this page/i)).toBeNull();
    expect(screen.queryByText(/export all/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /view/i }));

    await waitFor(() => {
      expect(screen.getByText('Position Applied For')).toBeTruthy();
    });

    expect(screen.queryByText('CandidateNotesTimeline')).toBeNull();
    expect(screen.queryByText('EmailTemplatesManager')).toBeNull();
    expect(screen.queryByRole('button', { name: /send email/i })).toBeNull();
  });

  it('uses a mobile-first candidate details layout for the application modal', async () => {
    renderManager();

    await screen.findByText(/candidate pipeline/i);

    fireEvent.click(screen.getByRole('button', { name: /view/i }));

    await waitFor(() => {
      expect(screen.getByText('Position Applied For')).toBeTruthy();
    });

    const content = screen.getByTestId('candidate-details-content');
    const basicInfo = screen.getByTestId('candidate-details-basic-info');
    const footer = screen.getByTestId('candidate-details-footer');
    const resumeButton = screen.getByRole('button', { name: /view resume/i });

    expect(content.className).toContain('p-4');
    expect(content.className).toContain('sm:p-6');
    expect(basicInfo.className).toContain('grid-cols-1');
    expect(basicInfo.className).toContain('md:grid-cols-2');
    expect(footer.className).toContain('flex-col');
    expect(footer.className).toContain('sm:flex-row');
    expect(resumeButton.className).toContain('w-full');
    expect(resumeButton.className).toContain('sm:w-auto');
  });
});
