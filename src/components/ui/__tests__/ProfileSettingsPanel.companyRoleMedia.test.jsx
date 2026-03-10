import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProfileSettingsPanel from '../ProfileSettingsPanel.jsx';

const mockUseAuth = vi.fn();
const mockUpdateProfile = vi.fn();
const mockUpdateProfilePhoto = vi.fn();
const mockUpdateCompanyLogo = vi.fn();

vi.mock('../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    auth: {
      updateProfile: (...args) => mockUpdateProfile(...args),
      updateProfilePhoto: (...args) => mockUpdateProfilePhoto(...args),
      updateCompanyLogo: (...args) => mockUpdateCompanyLogo(...args),
    },
  },
}));

vi.mock('../OrganizationSettings', () => ({
  default: () => <div>Organization Settings</div>,
}));

const buildCompanyUser = (role) => ({
  id: `user-${role.toLowerCase()}`,
  email: `${role.toLowerCase()}@example.com`,
  fullName: `${role} User`,
  accountType: 'COMPANY',
  jobTitle: role === 'RECRUITER' ? 'Talent Recruiter' : 'Hiring Reviewer',
  department: 'engineering',
  phoneNumber: '+94 771234567',
  profilePhotoUrl: '/uploads/profile-photos/existing-avatar.png',
  organizationContext: {
    membership: {
      role,
    },
  },
});

describe('ProfileSettingsPanel company-role media behavior', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUpdateProfile.mockReset();
    mockUpdateProfilePhoto.mockReset();
    mockUpdateCompanyLogo.mockReset();
    global.URL.createObjectURL = vi.fn(() => 'blob:profile-photo');
    global.URL.revokeObjectURL = vi.fn();

    mockUseAuth.mockReturnValue({
      user: buildCompanyUser('RECRUITER'),
      setAuthenticatedUser: vi.fn(),
    });

    mockUpdateProfile.mockResolvedValue({
      success: true,
      user: buildCompanyUser('RECRUITER'),
    });
    mockUpdateProfilePhoto.mockResolvedValue({
      success: true,
      user: buildCompanyUser('RECRUITER'),
    });
    mockUpdateCompanyLogo.mockResolvedValue({
      success: true,
      user: buildCompanyUser('RECRUITER'),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('uses personal profile-photo behavior for recruiter settings', async () => {
    const { container } = render(<ProfileSettingsPanel userType="company" />);

    expect(screen.getByText('Profile photo')).toBeTruthy();
    expect(screen.queryByText('Company logo')).toBeNull();

    const fileInput = container.querySelector('input[type="file"]');
    const photo = new File(['avatar'], 'recruiter-settings.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [photo] } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => {
      expect(mockUpdateProfilePhoto).toHaveBeenCalledWith(photo);
    });

    expect(mockUpdateCompanyLogo).not.toHaveBeenCalled();
  });

  it('shows the same personal profile-photo section for reviewer settings', () => {
    mockUseAuth.mockReturnValue({
      user: buildCompanyUser('REVIEWER'),
      setAuthenticatedUser: vi.fn(),
    });

    render(<ProfileSettingsPanel userType="company" />);

    expect(screen.getByText('Profile photo')).toBeTruthy();
    expect(
      screen.getByText('Keep your team-facing identity current for reviewer assignments and hiring collaboration.'),
    ).toBeTruthy();
    expect(screen.queryByText('Company logo')).toBeNull();
  });

  it('shows recruiter interview availability without exposing company-branding tabs', () => {
    render(<ProfileSettingsPanel userType="company" />);

    expect(screen.getByText('Interview Availability')).toBeTruthy();
    expect(screen.queryByText('Company Profile')).toBeNull();
    expect(screen.queryByText('Organization Settings')).toBeNull();
  });

  it('keeps recruiter working days in a single seven-column row on mobile', () => {
    render(<ProfileSettingsPanel userType="company" />);

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

  it('keeps reviewer settings focused on personal profile and preferences only', () => {
    mockUseAuth.mockReturnValue({
      user: buildCompanyUser('REVIEWER'),
      setAuthenticatedUser: vi.fn(),
    });

    render(<ProfileSettingsPanel userType="company" />);

    expect(screen.queryByText('Interview Availability')).toBeNull();
    expect(screen.queryByText('Company Profile')).toBeNull();
    expect(screen.queryByText('Organization Settings')).toBeNull();
  });
});
