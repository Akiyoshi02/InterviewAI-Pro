import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PrivacySettingsPage from '../index.jsx';
import apiClient from '../../../services/apiClient.js';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockUseMaintenanceMode = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
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
    gdpr: {
      getConsent: vi.fn(),
      saveConsent: vi.fn(),
      exportData: vi.fn(),
      requestDeletion: vi.fn(),
    },
  },
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

vi.mock('../../../components/ui/TwoFASettings', () => ({
  default: () => <div>TwoFASettings</div>,
}));

vi.mock('../../../components/AppIcon', () => ({
  default: ({ name }) => <span data-testid={`icon-${name || 'unknown'}`} />,
}));

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, className, onClick, disabled, type = 'button' }) => (
    <button type={type} className={className} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock('../../../components/ui/Checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, label }) => (
    <label>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
      />
      {label}
    </label>
  ),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <PrivacySettingsPage />
    </MemoryRouter>,
  );

describe('PrivacySettingsPage mobile header layout', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseAuth.mockReset();
    mockUseMaintenanceMode.mockReset();
    apiClient.gdpr.getConsent.mockReset();
    apiClient.gdpr.saveConsent.mockReset();
    apiClient.gdpr.exportData.mockReset();
    apiClient.gdpr.requestDeletion.mockReset();

    mockUseAuth.mockReturnValue({
      user: {
        id: 'candidate-1',
        accountType: 'CANDIDATE',
        pendingDeletion: false,
      },
      logout: vi.fn(),
    });

    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });
    apiClient.gdpr.getConsent.mockResolvedValue({ consent: null });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps the privacy header centered with the shared system badge layout', async () => {
    renderPage();

    const heading = await screen.findByText('Privacy & Data');
    const textGroup = heading.closest('div');
    const headerRow = textGroup?.parentElement;

    expect(textGroup).not.toBeNull();
    expect(textGroup.className).toContain('min-w-0');
    expect(headerRow).not.toBeNull();
    expect(headerRow.className).toContain('items-center');
    expect(headerRow.className).toContain('gap-4');
    expect(headerRow.firstElementChild.className).toContain('shrink-0');
    expect(headerRow.firstElementChild.className).toContain('p-3');
    expect(within(headerRow).getByTestId('icon-Shield')).toBeTruthy();
    expect(screen.getByText('Manage your data, consent preferences and account deletion rights under GDPR.')).toBeTruthy();
  });
});
