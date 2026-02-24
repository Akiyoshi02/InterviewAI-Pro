import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SchedulingWidget from '../SchedulingWidget.jsx';
import apiClient from '../../../../services/apiClient.js';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../../components/ui/Button.jsx', () => ({
  default: ({ children, onClick, disabled, type = 'button' }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('../../../../components/AppIcon.jsx', () => ({
  default: () => <span data-testid="mock-icon" />,
}));

vi.mock('../../../../services/apiClient.js', () => ({
  default: {
    interviews: {
      schedule: vi.fn(),
      reschedule: vi.fn(),
    },
  },
}));

describe('SchedulingWidget', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    apiClient.interviews.schedule.mockReset();
    apiClient.interviews.reschedule.mockReset();
    apiClient.interviews.schedule.mockResolvedValue({ success: true });
    apiClient.interviews.reschedule.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('reschedules and triggers onScheduleSaved callback without forcing a page reload', async () => {
    const onScheduleSaved = vi.fn().mockResolvedValue(undefined);
    const interview = {
      id: 'interview_1',
      status: 'SCHEDULED',
      company: { companyName: 'Acme Corp' },
      jobRole: 'Backend Engineer',
      interviewType: 'Technical',
      interviewerName: 'Alex',
      scheduledFor: '2026-03-10T10:00:00.000Z',
      duration: '45 min',
    };

    render(
      <SchedulingWidget
        upcomingInterviews={[interview]}
        onScheduleSaved={onScheduleSaved}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reschedule' }));
    const datetimeInput = document.querySelector('input[type="datetime-local"]');
    expect(datetimeInput).not.toBeNull();
    fireEvent.change(datetimeInput, { target: { value: '2026-03-12T11:30' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Schedule' }));

    await waitFor(() => {
      expect(apiClient.interviews.reschedule).toHaveBeenCalledTimes(1);
    });

    const [id, payload] = apiClient.interviews.reschedule.mock.calls[0];
    expect(id).toBe('interview_1');
    expect(payload).toMatchObject({
      scheduledFor: new Date('2026-03-12T11:30').toISOString(),
      meetingLink: null,
    });
    expect(typeof payload.timezone).toBe('string');
    expect(onScheduleSaved).toHaveBeenCalledTimes(1);
    expect(apiClient.interviews.schedule).not.toHaveBeenCalled();
  });

  it('provides non-blocking empty-state actions when there are no upcoming interviews', () => {
    render(<SchedulingWidget upcomingInterviews={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'My Applications' }));
    fireEvent.click(screen.getByRole('button', { name: 'View Applications' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open My Applications' }));

    expect(mockNavigate).toHaveBeenCalledWith('/my-applications');
    expect(mockNavigate).toHaveBeenCalledWith('/practice-interview-setup');
  });
});
