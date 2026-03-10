import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CompanyBillingPage from '../index.jsx';
import apiClient from '../../../services/apiClient.js';

const mockUseAuth = vi.fn();

vi.mock('../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../hooks/useMaintenanceMode', () => ({
  useMaintenanceMode: () => ({ maintenanceMode: false }),
}));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    billing: {
      getPlans: vi.fn(),
      getUsage: vi.fn(),
      getSubscription: vi.fn(),
      getBillingHistory: vi.fn(),
      createCheckoutSession: vi.fn(),
    },
  },
}));

vi.mock('../../../components/ui/Header', () => ({
  default: () => <div data-testid="header" />,
}));

vi.mock('../../../components/ui/UserContextNavigation', () => ({
  default: () => <div data-testid="nav" />,
}));

vi.mock('../../../components/ui/MaintenanceBanner', () => ({
  default: () => <div data-testid="maintenance-banner" />,
}));

vi.mock('../../../components/AppIcon', () => ({
  default: ({ name }) => <span data-testid={`icon-${name || 'default'}`} />,
}));

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, onClick, disabled, type = 'button', className }) => (
    <button type={type} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock('../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

describe('CompanyBillingPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: {
        id: 'company-admin-1',
        accountType: 'COMPANY',
        organizationContext: {
          membership: { role: 'ADMIN' },
        },
      },
      logout: vi.fn(),
      status: 'authenticated',
    });

    apiClient.billing.getUsage.mockResolvedValue({
      success: true,
      usage: {},
    });

    apiClient.billing.getSubscription.mockResolvedValue({
      success: true,
      subscription: {
        plan: { id: 'free', name: 'Free', price: 0, interval: 'month' },
        status: 'active',
      },
    });

    apiClient.billing.getBillingHistory.mockResolvedValue({
      success: true,
      history: [],
    });
  });

  it('disables upgrade buttons and shows setup guidance when payments are not configured', async () => {
    apiClient.billing.getPlans.mockResolvedValue({
      success: true,
      paymentsConfigured: false,
      plans: [
        { id: 'free', name: 'Free', price: 0, interval: 'month' },
        { id: 'starter', name: 'Starter', price: 19, interval: 'month' },
      ],
    });

    render(
      <MemoryRouter>
        <CompanyBillingPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Plans')).toBeTruthy();
    });

    expect(screen.getByText(/plan comparisons are available, but upgrades are disabled until stripe is configured/i)).toBeTruthy();
    expect(screen.getByText('Unavailable in this environment')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Upgrade' })).toBeNull();
  });

  it('keeps upgrade actions enabled when payments are configured', async () => {
    apiClient.billing.getPlans.mockResolvedValue({
      success: true,
      paymentsConfigured: true,
      plans: [
        { id: 'free', name: 'Free', price: 0, interval: 'month' },
        { id: 'starter', name: 'Starter', price: 19, interval: 'month' },
      ],
    });

    render(
      <MemoryRouter>
        <CompanyBillingPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Plans')).toBeTruthy();
    });

    expect(screen.queryByText(/plan comparisons are available, but upgrades are disabled until stripe is configured/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Upgrade' }).disabled).toBe(false);
  });
});
