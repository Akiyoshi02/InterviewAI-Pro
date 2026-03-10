import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CompanyWebhooksPage from '../index.jsx';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockUseMaintenanceMode = vi.fn();
const mockListWebhooks = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial, animate, exit, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

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

vi.mock('../../../hooks/useMaintenanceMode', () => ({
  useMaintenanceMode: () => mockUseMaintenanceMode(),
}));

vi.mock('../../../components/ui/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('../../../components/ui/UserContextNavigation', () => ({
  default: () => <div>User Context Navigation</div>,
}));

vi.mock('../../../components/ui/MaintenanceBanner', () => ({
  default: () => <div>MaintenanceBanner</div>,
}));

vi.mock('../../../components/AppIcon', () => ({
  default: ({ name, className }) => <span data-testid={`icon-${name || 'unknown'}`} className={className} />,
}));

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, className = '', iconName, variant, size, loading, ...props }) => (
    <button className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    webhooks: {
      list: (...args) => mockListWebhooks(...args),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      test: vi.fn(),
      deliveries: vi.fn(),
    },
  },
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <CompanyWebhooksPage />
    </MemoryRouter>,
  );

describe('CompanyWebhooksPage mobile header layout', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseAuth.mockReset();
    mockUseMaintenanceMode.mockReset();
    mockListWebhooks.mockReset();

    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        accountType: 'COMPANY',
        organizationContext: {
          membership: {
            role: 'ADMIN',
          },
        },
      },
      logout: vi.fn(),
    });
    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });
    mockListWebhooks.mockResolvedValue({
      success: true,
      webhooks: [],
      supportedEvents: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('uses the standardized webhooks header icon layout and mobile button sizing', async () => {
    renderPage();

    const heading = await screen.findByRole('heading', { level: 1, name: 'Webhooks' });
    const textGroup = heading.closest('div');
    const headerContent = textGroup?.parentElement;
    const headerRow = headerContent?.parentElement;
    const iconWrapper = within(headerRow).getByTestId('icon-Webhook').parentElement;
    const addButton = within(headerRow).getByRole('button', { name: /add webhook/i });
    const subtitle = screen.getByText('Receive real-time HTTP notifications when events happen in your hiring pipeline.');

    expect(textGroup).not.toBeNull();
    expect(textGroup.className).toContain('min-w-0');
    expect(headerRow).not.toBeNull();
    expect(headerRow.className).toContain('flex-col');
    expect(headerRow.className).toContain('sm:flex-row');
    expect(iconWrapper).not.toBeNull();
    expect(iconWrapper.className).toContain('shrink-0');
    expect(iconWrapper.className).toContain('p-3');
    expect(subtitle.className).toContain('mt-1');
    expect(addButton.className).toContain('w-full');
    expect(addButton.className).toContain('sm:w-auto');

    await waitFor(() => {
      expect(mockListWebhooks).toHaveBeenCalledTimes(1);
    });
  });
});
