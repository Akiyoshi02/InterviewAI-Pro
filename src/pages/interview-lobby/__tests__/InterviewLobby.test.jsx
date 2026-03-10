import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InterviewLobby from '../../interview-lobby/index.jsx';
import apiClient from '../../../services/apiClient.js';

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
let mockAuthState = {
  user: { id: 'candidate-1', accountType: 'CANDIDATE' },
  isAuthenticated: true,
  logout: vi.fn(),
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../components/ui/Header', () => ({
  default: () => <header data-testid="header" />,
}));

vi.mock('../../../components/ui/Button.jsx', () => ({
  default: ({ children, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

vi.mock('../../../components/AppIcon.jsx', () => ({
  default: ({ name }) => <span data-testid={`icon-${name}`} />,
}));

vi.mock('../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div data-testid="loading">{title}</div>,
}));

vi.mock('../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../../../hooks/useInterviewRealtimeFeed', () => ({
  useInterviewRealtimeFeed: vi.fn(),
}));

vi.mock('../../../constants/realtimeFeedEvents.js', () => ({
  INTERVIEW_FEED_EVENTS: { lifecycle: [], pipeline: [], reviews: [] },
  combineRealtimeEventTypes: vi.fn(() => []),
}));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    interviews: {
      getInterview: vi.fn(),
      validateMeetingAccess: vi.fn(),
    },
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────
const renderLobby = (interviewId = 'int-1', queryString = '') => {
  const path = `/interview-lobby/${interviewId}${queryString}`;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/interview-lobby/:interviewId" element={<InterviewLobby />} />
      </Routes>
    </MemoryRouter>,
  );
};

const sampleInterview = {
  id: 'int-1',
  jobRole: 'Software Engineer',
  experienceLevel: 'Mid',
  duration: 30,
  interviewTypes: ['Technical'],
  status: 'SCHEDULED',
};

// ============================================================================
describe('InterviewLobby', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = {
      user: { id: 'candidate-1', accountType: 'CANDIDATE' },
      isAuthenticated: true,
      logout: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
  });

  // ── Loading state ──
  it('shows loading state initially', () => {
    apiClient.interviews.validateMeetingAccess.mockReturnValue(new Promise(() => {})); // never resolves
    renderLobby('int-1', '?token=abc123');
    expect(screen.getByTestId('loading')).toBeTruthy();
  });

  it('shows a meeting-link-required message for candidates without a token', async () => {
    renderLobby('int-1', '');

    await waitFor(() => {
      expect(screen.getByText('Use Your Email Join Link')).toBeTruthy();
    });
    expect(apiClient.interviews.getInterview).not.toHaveBeenCalled();
    expect(apiClient.interviews.validateMeetingAccess).not.toHaveBeenCalled();
  });

  it('still allows company users to open the lobby without a token', async () => {
    mockAuthState = {
      user: { id: 'recruiter-1', accountType: 'COMPANY' },
      isAuthenticated: true,
      logout: vi.fn(),
    };
    apiClient.interviews.getInterview.mockResolvedValue({
      success: true,
      interview: sampleInterview,
    });

    renderLobby('int-1', '');
    await waitFor(() => {
      expect(apiClient.interviews.getInterview).toHaveBeenCalledWith('int-1');
    });
  });

  // ── With token → uses validateMeetingAccess ──
  it('calls validateMeetingAccess when token is in URL', async () => {
    apiClient.interviews.validateMeetingAccess.mockResolvedValue({
      success: true,
      interview: sampleInterview,
    });

    renderLobby('int-1', '?token=abc123');
    await waitFor(() => {
      expect(apiClient.interviews.validateMeetingAccess).toHaveBeenCalledWith('int-1', 'abc123');
    });
    expect(apiClient.interviews.getInterview).not.toHaveBeenCalled();
  });

  // ── Success display ──
  it('renders interview details after successful load', async () => {
    apiClient.interviews.validateMeetingAccess.mockResolvedValue({
      success: true,
      interview: sampleInterview,
    });

    renderLobby('int-1', '?token=abc123');
    await waitFor(() => {
      expect(screen.getByText('Software Engineer')).toBeTruthy();
    });
    expect(screen.getByText('30 minutes')).toBeTruthy();
    expect(screen.getByText('Technical')).toBeTruthy();
  });

  // ── Start Interview button navigates ──
  it('navigates to live-interview-session on Start Interview click', async () => {
    apiClient.interviews.validateMeetingAccess.mockResolvedValue({
      success: true,
      interview: sampleInterview,
    });

    renderLobby('int-1', '?token=abc123');
    await waitFor(() => {
      expect(screen.getByText('Software Engineer')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Start Interview'));
    expect(mockNavigate).toHaveBeenCalledWith('/live-interview-session?interviewId=int-1&token=abc123');
  });

  // ── TOO_EARLY error ──
  it('shows TOO_EARLY state with "Check Again" button', async () => {
    const error = new Error('The meeting link will become accessible 45 minutes from now.');
    error.code = 'TOO_EARLY';
    apiClient.interviews.validateMeetingAccess.mockRejectedValue(error);

    renderLobby('int-1', '?token=abc');
    await waitFor(() => {
      expect(screen.getByText('Interview Not Yet Available')).toBeTruthy();
    });
    expect(screen.getByText(/accessible 30 minutes before/)).toBeTruthy();
    expect(screen.getByText('Check Again')).toBeTruthy();
  });

  // ── EXPIRED error ──
  it('shows EXPIRED state without retry button', async () => {
    const error = new Error('The meeting window has closed.');
    error.code = 'EXPIRED';
    apiClient.interviews.validateMeetingAccess.mockRejectedValue(error);

    renderLobby('int-1', '?token=abc');
    await waitFor(() => {
      expect(screen.getByText('Meeting Link Expired')).toBeTruthy();
    });
    expect(screen.queryByText('Check Again')).toBeNull();
    expect(screen.queryByText('Try Again')).toBeNull();
  });

  // ── INVALID_TOKEN error ──
  it('shows INVALID_TOKEN state', async () => {
    const error = new Error('Invalid token');
    error.code = 'INVALID_TOKEN';
    apiClient.interviews.validateMeetingAccess.mockRejectedValue(error);

    renderLobby('int-1', '?token=bad');
    await waitFor(() => {
      expect(screen.getByText('Invalid Meeting Link')).toBeTruthy();
    });
    expect(screen.getByText(/invalid or has been replaced/)).toBeTruthy();
  });

  // ── Generic error (no access code) ──
  it('shows generic error for non-access-code failures', async () => {
    mockAuthState = {
      user: { id: 'recruiter-1', accountType: 'COMPANY' },
      isAuthenticated: true,
      logout: vi.fn(),
    };
    apiClient.interviews.getInterview.mockRejectedValue(new Error('Network error'));

    renderLobby('int-1', '');
    await waitFor(() => {
      expect(screen.getByText('Unable to Load Interview')).toBeTruthy();
    });
    expect(screen.getByText('Try Again')).toBeTruthy();
  });

  // ── Back to Dashboard button ──
  it('always shows Back to Dashboard button on error', async () => {
    const error = new Error('expired');
    error.code = 'EXPIRED';
    apiClient.interviews.validateMeetingAccess.mockRejectedValue(error);

    renderLobby('int-1', '?token=tok');
    await waitFor(() => {
      expect(screen.getByText('Meeting Link Expired')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Back to Dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/candidate-dashboard');
  });
});
