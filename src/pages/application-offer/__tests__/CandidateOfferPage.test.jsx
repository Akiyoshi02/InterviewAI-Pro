import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CandidateOfferPage from '../index.jsx';
import apiClient from '../../../services/apiClient.js';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
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

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    applications: {
      getApplication: vi.fn(),
      acceptOffer: vi.fn(),
      declineOffer: vi.fn(),
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

vi.mock('../../../components/AppIcon', () => ({
  default: ({ name }) => <span>{name || 'Icon'}</span>,
}));

const baseApplication = {
  id: 'application-offer-1',
  status: 'OFFER',
  job: {
    id: 'job-1',
    title: 'Data Analyst',
  },
  organization: {
    name: 'Cynectex',
  },
  offer: {
    title: 'Data Analyst Offer',
    compensationAmount: 450000,
    compensationCurrency: 'LKR',
    compensationPeriod: 'MONTHLY',
    startDate: '2026-04-01T00:00:00.000Z',
    expiresAt: '2099-04-15T12:00:00.000Z',
    note: 'Please review and respond through your dashboard.',
    status: 'PENDING',
  },
  offerHistory: [
    {
      id: 'history-1',
      eventType: 'SENT',
      createdAt: '2026-03-10T09:00:00.000Z',
      note: 'Initial offer shared with the candidate.',
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
  <MemoryRouter initialEntries={['/my-applications/application-offer-1/offer']}>
    <Routes>
      <Route path="/my-applications/:id/offer" element={<CandidateOfferPage />} />
    </Routes>
  </MemoryRouter>,
);

describe('CandidateOfferPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockDownloadOfferDocument.mockReset();
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'candidate-1',
        accountType: 'CANDIDATE',
      },
      logout: vi.fn().mockResolvedValue(undefined),
    });

    apiClient.applications.getApplication.mockReset();
    apiClient.applications.acceptOffer.mockReset();
    apiClient.applications.declineOffer.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads the structured offer details and history', async () => {
    apiClient.applications.getApplication.mockResolvedValue({
      success: true,
      application: baseApplication,
    });

    renderPage();

    await screen.findByRole('heading', { name: 'Data Analyst Offer' });

    expect(screen.getByText('Cynectex')).toBeTruthy();
    expect(screen.getAllByText(/\b450,000\b/).length).toBeGreaterThan(0);
    expect(screen.getByText('Offer Timeline')).toBeTruthy();
    expect(screen.getByText('Offer shared')).toBeTruthy();
  });

  it('lets the candidate accept the offer from the dedicated page', async () => {
    apiClient.applications.getApplication.mockResolvedValue({
      success: true,
      application: baseApplication,
    });
    apiClient.applications.acceptOffer.mockResolvedValue({
      success: true,
      message: 'Offer accepted successfully.',
      application: {
        ...baseApplication,
        status: 'HIRED',
        offer: {
          ...baseApplication.offer,
          status: 'ACCEPTED',
          acceptedAt: '2026-03-10T11:00:00.000Z',
        },
        offerHistory: [
          ...baseApplication.offerHistory,
          {
            id: 'history-2',
            eventType: 'ACCEPTED',
            createdAt: '2026-03-10T11:00:00.000Z',
            offer: baseApplication.offer,
          },
        ],
      },
    });

    renderPage();

    await screen.findByRole('heading', { name: 'Data Analyst Offer' });
    fireEvent.click(screen.getByRole('button', { name: /Accept Offer/i }));

    await waitFor(() => {
      expect(apiClient.applications.acceptOffer).toHaveBeenCalledWith('application-offer-1');
      expect(screen.getByText('Offer accepted successfully.')).toBeTruthy();
      expect(screen.getByText('ACCEPTED')).toBeTruthy();
      expect(screen.getByRole('button', { name: /view handoff/i })).toBeTruthy();
    });
  });

  it('downloads the offer pdf from the dedicated page', async () => {
    apiClient.applications.getApplication.mockResolvedValue({
      success: true,
      application: baseApplication,
    });

    renderPage();

    await screen.findByRole('heading', { name: 'Data Analyst Offer' });
    fireEvent.click(screen.getByRole('button', { name: /download offer pdf/i }));

    expect(mockDownloadOfferDocument).toHaveBeenCalledWith(baseApplication, { generatedFor: 'candidate' });
  });
});
