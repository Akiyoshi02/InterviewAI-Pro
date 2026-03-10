import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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

const buildCandidateUser = () => ({
  id: 'candidate-user',
  accountType: 'CANDIDATE',
  fullName: 'Jane Candidate',
  email: 'jane@example.com',
  targetRole: 'backend-developer',
  experienceLevel: 'entry',
  location: 'Ragama, Sri Lanka',
  phoneNumber: '+94 771234567',
  highestQualification: 'bachelors',
  fieldOfStudy: 'Software Engineering',
  institutionName: 'Sri Lanka Institute of Information Technology (SLIIT)',
  graduationYear: '2026',
  preferredLanguage: 'english',
});

describe('ProfileSettingsPanel candidate mobile layout', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUpdateProfile.mockReset();
    mockUpdateProfilePhoto.mockReset();
    mockUpdateCompanyLogo.mockReset();
    global.URL.createObjectURL = vi.fn(() => 'blob:profile-photo');
    global.URL.revokeObjectURL = vi.fn();

    mockUseAuth.mockReturnValue({
      user: buildCandidateUser(),
      setAuthenticatedUser: vi.fn(),
    });

    mockUpdateProfile.mockResolvedValue({
      success: true,
      user: buildCandidateUser(),
    });
    mockUpdateProfilePhoto.mockResolvedValue({
      success: true,
      user: buildCandidateUser(),
    });
    mockUpdateCompanyLogo.mockResolvedValue({
      success: true,
      user: buildCandidateUser(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('stacks the location field action below the input on mobile layouts', () => {
    render(<ProfileSettingsPanel userType="candidate" />);

    const locationInput = screen.getByLabelText('Location');
    const locationAction = screen.getByRole('button', { name: /Detect location/i });
    const actionWrapper = locationInput.parentElement;
    const sectionWrapper = actionWrapper?.parentElement;

    expect(sectionWrapper).not.toBeNull();
    expect(sectionWrapper.className).toContain('min-w-0');
    expect(actionWrapper).not.toBeNull();
    expect(actionWrapper.className).toContain('flex-col');
    expect(actionWrapper.className).toContain('sm:relative');

    expect(locationInput.className).toContain('min-w-0');
    expect(locationInput.className).toContain('pr-3');
    expect(locationInput.className).toContain('sm:pr-[100px]');

    expect(locationAction.className).toContain('w-full');
    expect(locationAction.className).toContain('justify-center');
    expect(locationAction.className).toContain('sm:absolute');
    expect(locationAction.className).toContain('sm:w-auto');
  });
});
