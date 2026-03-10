import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyApplicationsList from '../MyApplicationsList.jsx';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockUseRealtimePathFeed = vi.fn();
const mockDownloadOfferDocument = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('framer-motion', () => {
  const MotionTag = ({ children, ...props }) => <div {...props}>{children}</div>;
  return {
    motion: new Proxy({}, { get: () => MotionTag }),
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

vi.mock('../../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../../hooks/useRealtimePathFeed', () => ({
  useRealtimePathFeed: (args) => mockUseRealtimePathFeed(args),
}));

vi.mock('../../../../services/apiClient.js', () => ({
  default: {
    applications: {
      getMyApplications: vi.fn(),
      withdraw: vi.fn(),
      acceptOffer: vi.fn(),
      declineOffer: vi.fn(),
    },
  },
}));

vi.mock('../../../../utils/offerDocument.js', () => ({
  downloadOfferDocument: (...args) => mockDownloadOfferDocument(...args),
}));

vi.mock('../../../../components/AppIcon', () => ({
  default: () => <span data-testid="mock-icon" />,
}));

vi.mock('../../../../components/ui/Button', () => ({
  default: ({ children, onClick, type = 'button', disabled, ...rest }) => (
    <button type={type} onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock('../../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock('../../../../components/ui/ConfirmDialog', () => ({
  default: () => null,
}));

vi.mock('../../../../components/ui/UnifiedFilterPanel', () => ({
  default: ({ children }) => <div>{children}</div>,
  FILTER_DATE_GRID_CLASS: '',
  FILTER_GRID_CLASS: '',
  FILTER_SUBPANEL_CLASS: '',
  UnifiedFilterField: ({ label, children }) => (
    <label>
      <span>{label}</span>
      {children}
    </label>
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
  UnifiedSearchField: ({ label, value, onChange }) => (
    <label>
      <span>{label}</span>
      <input aria-label={label} value={value} onChange={onChange} />
    </label>
  ),
  UnifiedTextInput: ({ value, onChange, type = 'text' }) => (
    <input type={type} value={value} onChange={onChange} />
  ),
}));

import apiClient from '../../../../services/apiClient.js';

const offerApplication = {
  id: 'application-offer-1',
  status: 'OFFER',
  submittedAt: '2026-03-01T10:00:00.000Z',
  createdAt: '2026-03-01T10:00:00.000Z',
  job: {
    id: 'job-1',
    title: 'Data Analyst',
    employmentType: 'FULL_TIME',
    location: 'Colombo',
  },
  organization: {
    name: 'Cynectex',
    logo: null,
  },
  offer: {
    title: 'Data Analyst Offer',
    compensationAmount: 450000,
    compensationCurrency: 'LKR',
    compensationPeriod: 'MONTHLY',
    startDate: '2026-04-01T00:00:00.000Z',
    expiresAt: '2099-04-15T12:00:00.000Z',
    note: 'Please respond through your dashboard.',
    status: 'PENDING',
  },
};

describe('MyApplicationsList offer flow', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseRealtimePathFeed.mockReset();
    mockDownloadOfferDocument.mockReset();
    mockUseAuth.mockReturnValue({
      user: {
        id: 'candidate-1',
        accountType: 'CANDIDATE',
      },
    });

    apiClient.applications.getMyApplications.mockReset();
    apiClient.applications.withdraw.mockReset();
    apiClient.applications.acceptOffer.mockReset();
    apiClient.applications.declineOffer.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const renderList = () =>
    render(
      <MemoryRouter>
        <MyApplicationsList />
      </MemoryRouter>,
    );

  it('lets the candidate accept a pending offer from the application list', async () => {
    apiClient.applications.getMyApplications.mockResolvedValue({
      success: true,
      applications: [offerApplication],
    });
    apiClient.applications.acceptOffer.mockResolvedValue({
      success: true,
      message: 'Offer accepted successfully.',
    });

    renderList();

    await screen.findByText('Offer Stage');
    fireEvent.click(screen.getByRole('button', { name: /Accept Offer/i }));

    await waitFor(() => {
      expect(apiClient.applications.acceptOffer).toHaveBeenCalledWith('application-offer-1');
      expect(screen.getByText('Offer accepted successfully.')).toBeTruthy();
    });
  });

  it('lets the candidate decline a pending offer with a note', async () => {
    apiClient.applications.getMyApplications.mockResolvedValue({
      success: true,
      applications: [offerApplication],
    });
    apiClient.applications.declineOffer.mockResolvedValue({
      success: true,
      message: 'Offer declined successfully.',
    });

    renderList();

    await screen.findByText('Offer Stage');
    fireEvent.click(screen.getByRole('button', { name: /Decline Offer/i }));
    fireEvent.change(screen.getByPlaceholderText(/Optional note for the hiring team/i), {
      target: { value: 'I accepted another role.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirm Decline/i }));

    await waitFor(() => {
      expect(apiClient.applications.declineOffer).toHaveBeenCalledWith('application-offer-1', {
        declineReason: 'I accepted another role.',
      });
      expect(screen.getByText('Offer declined successfully.')).toBeTruthy();
    });
  });

  it('shows the hired handoff entry point after an accepted offer', async () => {
    apiClient.applications.getMyApplications.mockResolvedValue({
      success: true,
      applications: [
        {
          ...offerApplication,
          status: 'HIRED',
          offer: {
            ...offerApplication.offer,
            status: 'ACCEPTED',
            acceptedAt: '2026-03-11T09:00:00.000Z',
          },
        },
      ],
    });

    renderList();

    await screen.findByText('Offer Stage');
    fireEvent.click(screen.getByRole('button', { name: /view handoff/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/my-applications/application-offer-1/handoff');
  });

  it('shows the onboarding entry point after an accepted offer has moved to hired', async () => {
    apiClient.applications.getMyApplications.mockResolvedValue({
      success: true,
      applications: [
        {
          ...offerApplication,
          status: 'HIRED',
          offer: {
            ...offerApplication.offer,
            status: 'ACCEPTED',
            acceptedAt: '2026-03-11T09:00:00.000Z',
          },
          onboarding: {
            status: 'IN_PROGRESS',
            tasks: [{ id: 'task-1', title: 'Confirm personal details', owner: 'CANDIDATE', status: 'PENDING' }],
          },
        },
      ],
    });

    renderList();

    await screen.findByText('Offer Stage');
    fireEvent.click(screen.getByRole('button', { name: /open onboarding/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/my-applications/application-offer-1/onboarding');
  });
});
