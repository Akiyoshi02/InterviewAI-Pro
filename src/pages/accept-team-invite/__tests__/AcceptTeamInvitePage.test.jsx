import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AcceptTeamInvitePage from '../index.jsx';
import apiClient from '../../../services/apiClient.js';
import { authHelpers } from '../../../config/firebase.js';

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    teamInvitations: {
      getByToken: vi.fn(),
    },
    auth: {
      register: vi.fn(),
    },
    uploads: {
      moderateProfilePhoto: vi.fn(),
    },
  },
}));

vi.mock('../../../config/firebase.js', () => ({
  authHelpers: {
    getSession: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    signIn: vi.fn(),
    refreshAccessToken: vi.fn(),
  },
}));

vi.mock('../../../components/ui/Input', () => ({
  default: ({ label, value, onChange, type = 'text', disabled, required, placeholder, error }) => (
    <label>
      <span>{label}</span>
      <input
        aria-label={label}
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
      />
      {error ? <span>{error}</span> : null}
    </label>
  ),
}));

vi.mock('../../../components/ui/Select', () => ({
  default: ({ label, value, onChange, options = [] }) => (
    <label>
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, onClick, type = 'button', disabled }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('../../../components/AppIcon', () => ({
  default: () => <span data-testid="mock-icon" />,
}));

vi.mock('../../../components/ui/PhoneInput', () => ({
  default: ({ label, value, onChange }) => (
    <label>
      <span>{label}</span>
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </label>
  ),
}));

vi.mock('../../register/components/PasswordStrengthIndicator', () => ({
  default: () => <div data-testid="password-strength-indicator" />,
}));

vi.mock('../../register/components/PasswordMatchIndicator', () => ({
  default: () => <div data-testid="password-match-indicator" />,
}));

const invitation = {
  email: 'akiyoshiyapa+recruiter@gmail.com',
  role: 'RECRUITER',
  organization: {
    name: 'Cynectex',
  },
};

const reviewerInvitation = {
  email: 'akiyoshiyapa+reviewer@gmail.com',
  role: 'REVIEWER',
  organization: {
    name: 'Cynectex',
  },
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/accept-team-invite/token-123']}>
      <Routes>
        <Route path="/accept-team-invite/:token" element={<AcceptTeamInvitePage />} />
        <Route path="/login" element={<div>Login Screen</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('AcceptTeamInvitePage', () => {
  beforeEach(() => {
    apiClient.teamInvitations.getByToken.mockReset();
    apiClient.auth.register.mockReset();
    apiClient.uploads.moderateProfilePhoto.mockReset();
    authHelpers.getSession.mockReset();
    authHelpers.signOut.mockReset();
    authHelpers.signUp.mockReset();
    authHelpers.signIn.mockReset();
    authHelpers.refreshAccessToken.mockReset();
    global.URL.createObjectURL = vi.fn(() => 'blob:profile-preview');
    global.URL.revokeObjectURL = vi.fn();

    apiClient.teamInvitations.getByToken.mockResolvedValue({
      success: true,
      invitation,
    });
    authHelpers.getSession.mockResolvedValue({
      data: {
        session: null,
      },
    });
    authHelpers.signUp.mockResolvedValue({
      data: {
        user: {
          id: 'firebase-user-1',
          email: invitation.email,
        },
      },
      error: null,
    });
    authHelpers.refreshAccessToken.mockResolvedValue('fresh-token');
    authHelpers.signOut.mockResolvedValue({ error: null });
    apiClient.uploads.moderateProfilePhoto.mockResolvedValue({
      success: true,
    });
    apiClient.auth.register.mockResolvedValue({
      success: true,
      user: {
        id: 'app-user-1',
        email: invitation.email,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('creates the invited account without forcing email verification', async () => {
    renderPage();

    await screen.findByText(/you've been invited to join/i);
    expect(screen.getByText('Registration Progress')).toBeTruthy();
    expect(screen.getByText("What you'll unlock")).toBeTruthy();
    expect(screen.getByText('Create your recruiter account')).toBeTruthy();
    expect(screen.getAllByText('Cynectex').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Recruiter Test User' },
    });
    fireEvent.change(screen.getByLabelText('Job Title'), {
      target: { value: 'Talent Recruiter' },
    });
    const profilePhoto = new File(['avatar'], 'recruiter-avatar.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Profile Photo'), {
      target: { files: [profilePhoto] },
    });
    await waitFor(() => {
      expect(apiClient.uploads.moderateProfilePhoto).toHaveBeenCalledWith(profilePhoto);
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Aki16487@#Recruiter' },
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'Aki16487@#Recruiter' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create account & join team/i }));

    await waitFor(() => {
      expect(authHelpers.signUp).toHaveBeenCalledWith(
        invitation.email,
        'Aki16487@#Recruiter',
        expect.objectContaining({
          fullName: 'Recruiter Test User',
          accountType: 'COMPANY',
        }),
      );
    });

    await waitFor(() => {
      expect(apiClient.auth.register).toHaveBeenCalledWith(expect.any(FormData));
    });
    const submittedFormData = apiClient.auth.register.mock.calls[0][0];
    expect(submittedFormData.get('fullName')).toBe('Recruiter Test User');
    expect(submittedFormData.get('email')).toBe(invitation.email);
    expect(submittedFormData.get('accountType')).toBe('COMPANY');
    expect(submittedFormData.get('teamInvitationToken')).toBe('token-123');
    expect(submittedFormData.get('jobTitle')).toBe('Talent Recruiter');
    expect(submittedFormData.get('profilePhoto')).toBe(profilePhoto);

    expect(authHelpers.refreshAccessToken).toHaveBeenCalled();
    expect(screen.getByText('Login Screen')).toBeTruthy();
  });

  it('renders reviewer-specific onboarding copy with the shared registration shell', async () => {
    apiClient.teamInvitations.getByToken.mockResolvedValueOnce({
      success: true,
      invitation: reviewerInvitation,
    });

    renderPage();

    await screen.findByText(/you've been invited to join/i);

    expect(screen.getByText('Registration Progress')).toBeTruthy();
    expect(screen.getByText('Create your reviewer account')).toBeTruthy();
    expect(screen.getByText('Review interview submissions')).toBeTruthy();
    expect(screen.getByText('Read-only team visibility')).toBeTruthy();
  });
});
