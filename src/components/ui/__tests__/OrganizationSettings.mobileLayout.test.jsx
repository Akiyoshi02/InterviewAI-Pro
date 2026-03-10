import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import OrganizationSettings from '../OrganizationSettings.jsx';

const mockUseAuth = vi.fn();

vi.mock('../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    auth: {
      updateCompanyLogo: vi.fn(),
    },
    organizations: {
      updateMyOrganization: vi.fn(),
    },
  },
}));

vi.mock('../Button', () => ({
  default: ({ children, className = '', iconName, variant, size, loading, ...props }) => (
    <button className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../Input', () => ({
  default: ({ label, className = '', ...props }) => (
    <label>
      <span>{label}</span>
      <input className={className} {...props} />
    </label>
  ),
}));

vi.mock('../Select', () => ({
  default: ({ label, className = '', options = [], value, onChange, ...props }) => (
    <label>
      <span>{label}</span>
      <select className={className} value={value} onChange={(event) => onChange?.(event.target.value)} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));

vi.mock('../Checkbox', () => ({
  Checkbox: ({ checked, ...props }) => <input type="checkbox" checked={checked} {...props} />,
}));

vi.mock('../PhoneInput', () => ({
  default: ({ label, className = '', value, onChange, ...props }) => (
    <label>
      <span>{label}</span>
      <input className={className} value={value} onChange={(event) => onChange?.(event.target.value)} {...props} />
    </label>
  ),
}));

vi.mock('../../AppIcon', () => ({
  default: ({ name }) => <span data-testid={`icon-${name || 'unknown'}`} />,
}));

const buildAuthState = () => ({
  organizationRole: 'ADMIN',
  refresh: vi.fn(),
  setAuthenticatedUser: vi.fn(),
  user: {
    email: 'admin@example.com',
    companyLogoUrl: '',
    organizationContext: {
      organization: {
        branding: {},
      },
    },
  },
  organization: {
    id: 'org-1',
    name: 'Acme Labs',
    displayName: 'Acme Labs',
    location: 'Colombo',
    contactEmail: 'admin@example.com',
    settings: {
      interviewAutomation: {
        workingDays: [1, 2, 3, 4, 5],
      },
    },
  },
});

describe('OrganizationSettings mobile working days layout', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    global.URL.createObjectURL = vi.fn(() => 'blob:logo-preview');
    global.URL.revokeObjectURL = vi.fn();
    mockUseAuth.mockReturnValue(buildAuthState());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps working day pills in a single seven-column row on mobile', () => {
    render(<OrganizationSettings />);

    const workingDaysLabel = screen.getByText('Working days');
    const dayGrid = workingDaysLabel.nextElementSibling;
    const mondayButton = screen.getByRole('button', { name: 'Mon' });

    expect(dayGrid).not.toBeNull();
    expect(dayGrid.className).toContain('grid-cols-7');
    expect(dayGrid.className).toContain('gap-1.5');
    expect(mondayButton.className).toContain('min-h-[44px]');
    expect(mondayButton.className).toContain('min-w-0');
    expect(mondayButton.className).toContain('px-0');
    expect(mondayButton.className).toContain('text-sm');
    expect(mondayButton.className).toContain('sm:text-xs');
  });
});
