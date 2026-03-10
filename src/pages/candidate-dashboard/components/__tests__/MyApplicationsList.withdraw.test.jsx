import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyApplicationsList from '../MyApplicationsList.jsx';
import apiClient from '../../../../services/apiClient.js';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockUseRealtimePathFeed = vi.fn();

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
    },
  },
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
  default: ({ open, title, message, onClose, onConfirm }) =>
    open ? (
      <div>
        <p>{title}</p>
        <p>{message}</p>
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="button" onClick={onConfirm}>Withdraw</button>
      </div>
    ) : null,
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
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      >
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

const baseApplication = {
  id: 'application-1',
  status: 'SUBMITTED',
  submittedAt: '2026-03-01T10:00:00.000Z',
  createdAt: '2026-03-01T10:00:00.000Z',
  job: {
    id: 'job-1',
    title: 'Backend Engineer',
    employmentType: 'FULL_TIME',
    location: 'Remote',
  },
  organization: {
    name: 'Acme Inc',
    logo: null,
  },
};

const buildApplication = (index) => ({
  ...baseApplication,
  id: `application-${index}`,
  submittedAt: `2026-03-0${Math.min(index, 9)}T10:00:00.000Z`,
  createdAt: `2026-03-0${Math.min(index, 9)}T10:00:00.000Z`,
  job: {
    ...baseApplication.job,
    id: `job-${index}`,
    title: `Backend Engineer ${index}`,
  },
});

describe('MyApplicationsList withdraw flow', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseRealtimePathFeed.mockReset();

    mockUseAuth.mockReturnValue({
      user: {
        id: 'candidate-1',
        accountType: 'CANDIDATE',
      },
    });

    apiClient.applications.getMyApplications.mockReset();
    apiClient.applications.withdraw.mockReset();
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

  it('renders empty-state and routes to jobs when candidate has no applications', async () => {
    apiClient.applications.getMyApplications.mockResolvedValue({
      success: true,
      applications: [],
    });

    renderList();

    await waitFor(() => {
      expect(screen.queryByText('No Applications Yet')).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /Browse Jobs/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/jobs');
  });

  it('withdraws a candidate application and shows success feedback', async () => {
    apiClient.applications.getMyApplications.mockResolvedValue({
      success: true,
      applications: [baseApplication],
    });
    apiClient.applications.withdraw.mockResolvedValue({
      success: true,
    });

    renderList();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Withdraw/i })).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /Withdraw/i }));
    const confirmDialog = screen.getByText('Withdraw Application').parentElement;
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /^Withdraw$/i }));

    await waitFor(() => {
      expect(apiClient.applications.withdraw).toHaveBeenCalledWith('application-1');
      expect(screen.queryByText('Application withdrawn successfully.')).not.toBeNull();
    });
  });

  it('shows an error message when withdraw request fails', async () => {
    apiClient.applications.getMyApplications.mockResolvedValue({
      success: true,
      applications: [baseApplication],
    });
    apiClient.applications.withdraw.mockRejectedValue(new Error('Cannot withdraw right now'));

    renderList();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Withdraw/i })).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /Withdraw/i }));
    const confirmDialog = screen.getByText('Withdraw Application').parentElement;
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /^Withdraw$/i }));

    await waitFor(() => {
      expect(apiClient.applications.withdraw).toHaveBeenCalledWith('application-1');
      expect(screen.queryByText('Cannot withdraw right now')).not.toBeNull();
    });
  });

  it('stacks pagination controls cleanly for mobile layouts when applications span multiple pages', async () => {
    apiClient.applications.getMyApplications.mockResolvedValue({
      success: true,
      applications: [1, 2, 3, 4].map((index) => buildApplication(index)),
    });

    renderList();

    const summary = await screen.findByText('Showing 1 to 3 of 4 positions');
    const pagination = summary.parentElement;
    expect(pagination).not.toBeNull();
    expect(pagination.className).toContain('flex-col');
    expect(pagination.className).toContain('sm:flex-row');
    expect(summary.className).toContain('text-center');
    expect(summary.className).toContain('sm:text-left');

    const previousButton = screen.getByRole('button', { name: /Previous page/i });
    const nextButton = screen.getByRole('button', { name: /Next page/i });
    const controlsRow = previousButton.parentElement;
    expect(controlsRow).not.toBeNull();
    expect(controlsRow.className).toContain('flex-wrap');
    expect(controlsRow.className).toContain('justify-center');

    const pageButtonsRow = screen.getByRole('button', { name: '1' }).parentElement;
    expect(pageButtonsRow).not.toBeNull();
    expect(pageButtonsRow.className).toContain('order-first');
    expect(pageButtonsRow.className).toContain('w-full');

    expect(previousButton.className).toContain('min-w-[88px]');
    expect(nextButton.className).toContain('min-w-[88px]');
  });
});
