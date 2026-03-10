import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HiredHandoffPage from '../index.jsx';
import apiClient from '../../../services/apiClient.js';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockUseMaintenanceMode = vi.fn();
const mockDownloadOfferDocument = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    applications: {
      getApplication: vi.fn(),
    },
  },
}));

vi.mock('../../../utils/offerDocument.js', () => ({
  downloadOfferDocument: (...args) => mockDownloadOfferDocument(...args),
}));

vi.mock('../../../components/ui/Header', () => ({
  default: () => <div data-testid="header" />,
}));

vi.mock('../../../components/ui/UserContextNavigation', () => ({
  default: () => <div data-testid="candidate-nav" />,
}));

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, onClick, type = 'button', disabled, loading, ...props }) => (
    <button type={type} onClick={onClick} disabled={disabled || loading} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock('../../../components/ui/MaintenanceBanner', () => ({
  default: () => <div>MaintenanceBanner</div>,
}));

vi.mock('../../../components/AppIcon', () => ({
  default: ({ name }) => <span>{name || 'Icon'}</span>,
}));

const hiredApplication = {
  id: 'application-hired-1',
  status: 'HIRED',
  job: { id: 'job-1', title: 'Data Analyst' },
  organization: { name: 'Cynectex' },
  offer: {
    title: 'Data Analyst Offer',
    compensationAmount: 450000,
    compensationCurrency: 'LKR',
    compensationPeriod: 'MONTHLY',
    startDate: '2026-04-01T00:00:00.000Z',
    expiresAt: '2099-04-15T12:00:00.000Z',
    acceptedAt: '2026-03-11T09:00:00.000Z',
    status: 'ACCEPTED',
    note: 'Bring your signed ID on day one.',
  },
  offerHistory: [
    {
      id: 'history-1',
      eventType: 'ACCEPTED',
      createdAt: '2026-03-11T09:00:00.000Z',
      note: 'Candidate accepted the offer.',
      offer: {
        title: 'Data Analyst Offer',
        compensationAmount: 450000,
        compensationCurrency: 'LKR',
        compensationPeriod: 'MONTHLY',
      },
    },
  ],
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/my-applications/application-hired-1/handoff']}>
    <Routes>
      <Route path="/my-applications/:id/handoff" element={<HiredHandoffPage />} />
    </Routes>
  </MemoryRouter>,
);

describe('HiredHandoffPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockDownloadOfferDocument.mockReset();
    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'candidate-1',
        accountType: 'CANDIDATE',
      },
      logout: vi.fn().mockResolvedValue(undefined),
    });
    apiClient.applications.getApplication.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the hired handoff when the offer is accepted and the application is hired', async () => {
    apiClient.applications.getApplication.mockResolvedValue({
      success: true,
      application: hiredApplication,
    });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Data Analyst Offer' })).toBeTruthy();
    expect(screen.getByText('Next Steps')).toBeTruthy();
    expect(screen.getByText(/confirm any requested documents/i)).toBeTruthy();
  });

  it('shows a not-ready state when the application is not fully hired yet', async () => {
    apiClient.applications.getApplication.mockResolvedValue({
      success: true,
      application: {
        ...hiredApplication,
        status: 'OFFER',
      },
    });

    renderPage();

    expect(await screen.findByText('Handoff not ready')).toBeTruthy();
  });

  it('downloads the accepted offer PDF from the handoff page', async () => {
    apiClient.applications.getApplication.mockResolvedValue({
      success: true,
      application: hiredApplication,
    });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Data Analyst Offer' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /download offer pdf/i }));

    expect(mockDownloadOfferDocument).toHaveBeenCalledWith(hiredApplication, { generatedFor: 'candidate' });
  });
});
