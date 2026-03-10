import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CompanyOfferPage from '../index.jsx';
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
      upsertOffer: vi.fn(),
      resendOffer: vi.fn(),
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
  default: () => <div data-testid="company-nav" />,
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

const baseApplication = {
  id: 'application-offer-1',
  status: 'OFFER',
  candidate: { fullName: 'Aki Yapa' },
  job: { id: 'job-1', title: 'Data Analyst' },
  organization: { name: 'Cynectex' },
  offer: {
    title: 'Data Analyst Offer',
    compensationAmount: 450000,
    compensationCurrency: 'LKR',
    compensationPeriod: 'MONTHLY',
    startDate: '2026-04-01T00:00:00.000Z',
    expiresAt: '2099-04-15T12:00:00.000Z',
    note: 'Final compensation approved.',
    status: 'PENDING',
    sentAt: '2026-03-10T09:00:00.000Z',
  },
  offerHistory: [
    {
      id: 'history-1',
      eventType: 'SENT',
      createdAt: '2026-03-10T09:00:00.000Z',
      note: 'Initial offer shared.',
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
  <MemoryRouter initialEntries={['/company-applications/application-offer-1/offer']}>
    <Routes>
      <Route path="/company-applications/:id/offer" element={<CompanyOfferPage />} />
    </Routes>
  </MemoryRouter>,
);

describe('CompanyOfferPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockDownloadOfferDocument.mockReset();
    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'recruiter-1',
        accountType: 'COMPANY',
        organizationContext: {
          membership: { role: 'RECRUITER' },
        },
      },
      logout: vi.fn().mockResolvedValue(undefined),
    });
    apiClient.applications.getApplication.mockReset();
    apiClient.applications.upsertOffer.mockReset();
    apiClient.applications.resendOffer.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads the structured offer workspace and history', async () => {
    apiClient.applications.getApplication.mockResolvedValue({
      success: true,
      application: baseApplication,
    });

    renderPage();

    await screen.findByRole('heading', { name: 'Data Analyst Offer' });

    expect(screen.getByText('Aki Yapa')).toBeTruthy();
    expect(screen.getByText('Offer Timeline')).toBeTruthy();
    expect(screen.getByText('Offer shared')).toBeTruthy();
  });

  it('lets recruiters save and resend offer details', async () => {
    apiClient.applications.getApplication.mockResolvedValue({
      success: true,
      application: baseApplication,
    });
    apiClient.applications.upsertOffer.mockResolvedValue({
      success: true,
      message: 'Offer details saved.',
      application: baseApplication,
    });
    apiClient.applications.resendOffer.mockResolvedValue({
      success: true,
      message: 'Offer email resent successfully.',
      application: baseApplication,
    });

    renderPage();

    await screen.findByRole('heading', { name: 'Data Analyst Offer' });
    fireEvent.click(screen.getByRole('button', { name: /save offer details/i }));

    await waitFor(() => {
      expect(apiClient.applications.upsertOffer).toHaveBeenCalledWith(
        'application-offer-1',
        expect.objectContaining({
          title: 'Data Analyst Offer',
          compensationAmount: 450000,
        }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /resend offer email/i }));

    await waitFor(() => {
      expect(apiClient.applications.resendOffer).toHaveBeenCalledWith('application-offer-1');
      expect(screen.getByText(/offer email resent successfully/i)).toBeTruthy();
    });
  });

  it('downloads the offer PDF from the workspace', async () => {
    apiClient.applications.getApplication.mockResolvedValue({
      success: true,
      application: baseApplication,
    });

    renderPage();

    await screen.findByRole('heading', { name: 'Data Analyst Offer' });
    fireEvent.click(screen.getByRole('button', { name: /download offer pdf/i }));

    expect(mockDownloadOfferDocument).toHaveBeenCalledWith(baseApplication, { generatedFor: 'company' });
  });
});
