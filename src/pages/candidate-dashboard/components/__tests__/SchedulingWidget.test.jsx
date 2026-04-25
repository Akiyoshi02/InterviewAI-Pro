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
  default: ({ children, onClick, disabled, type = 'button', className }) => (
    <button type={type} onClick={onClick} disabled={disabled} className={className}>
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
      requestReschedule: vi.fn(),
    },
  },
}));

const toDateTimeLocal = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const futureDate = (daysAhead, hours = 10, minutes = 0) => {
  const date = new Date(Date.now() + (daysAhead * 24 * 60 * 60 * 1000));
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const futureIso = (daysAhead, hours = 10, minutes = 0) => futureDate(daysAhead, hours, minutes).toISOString();

describe('SchedulingWidget', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    apiClient.interviews.schedule.mockReset();
    apiClient.interviews.reschedule.mockReset();
    apiClient.interviews.requestReschedule.mockReset();
    apiClient.interviews.schedule.mockResolvedValue({ success: true });
    apiClient.interviews.reschedule.mockResolvedValue({ success: true });
    apiClient.interviews.requestReschedule.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    vi.clearAllMocks();
  });

  it('reschedules and triggers onScheduleSaved callback without forcing a page reload', async () => {
    const onScheduleSaved = vi.fn().mockResolvedValue(undefined);
    const interview = {
      id: 'interview_1',
      status: 'SCHEDULED',
      mode: 'PRACTICE',
      company: { companyName: 'Acme Corp' },
      jobRole: 'Backend Engineer',
      interviewType: 'Technical',
      interviewerName: 'Alex',
      scheduledFor: futureIso(12, 10, 0),
      duration: '45 min',
    };
    const rescheduledSlot = toDateTimeLocal(futureDate(12, 11, 30));

    render(
      <SchedulingWidget
        upcomingInterviews={[interview]}
        onScheduleSaved={onScheduleSaved}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reschedule' }));
    const datetimeInput = document.querySelector('input[type="datetime-local"]');
    expect(datetimeInput).not.toBeNull();
    fireEvent.change(datetimeInput, { target: { value: rescheduledSlot } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Schedule' }));

    await waitFor(() => {
      expect(apiClient.interviews.reschedule).toHaveBeenCalledTimes(1);
    });

    const [id, payload] = apiClient.interviews.reschedule.mock.calls[0];
    expect(id).toBe('interview_1');
    expect(payload).toMatchObject({
      scheduledFor: new Date(rescheduledSlot).toISOString(),
    });
    expect(payload).not.toHaveProperty('meetingLink');
    expect(typeof payload.timezone).toBe('string');
    expect(onScheduleSaved).toHaveBeenCalledTimes(1);
    expect(apiClient.interviews.schedule).not.toHaveBeenCalled();
  });

  it('blocks practice rescheduling when the selected time is in the past', async () => {
    const interview = {
      id: 'interview_1',
      status: 'SCHEDULED',
      mode: 'PRACTICE',
      company: { companyName: 'Acme Corp' },
      jobRole: 'Backend Engineer',
      interviewType: 'Technical',
      interviewerName: 'Alex',
      scheduledFor: futureIso(12, 10, 0),
      duration: '45 min',
    };

    render(<SchedulingWidget upcomingInterviews={[interview]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reschedule' }));
    const datetimeInput = document.querySelector('input[type="datetime-local"]');
    expect(datetimeInput).not.toBeNull();
    fireEvent.change(datetimeInput, { target: { value: toDateTimeLocal(new Date(Date.now() - (60 * 60 * 1000))) } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Schedule' }));

    await waitFor(() => {
      expect(screen.getByText('Interview date and time must be in the future.')).toBeTruthy();
    });
    expect(apiClient.interviews.reschedule).not.toHaveBeenCalled();
    expect(apiClient.interviews.schedule).not.toHaveBeenCalled();
  });

  it('provides non-blocking empty-state actions when there are no upcoming interviews', () => {
    render(<SchedulingWidget upcomingInterviews={[]} />);

    expect(screen.queryByRole('button', { name: 'My Applications' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View Applications' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));

    expect(mockNavigate).toHaveBeenCalledWith('/my-applications');
    expect(mockNavigate).toHaveBeenCalledWith('/practice-interview-setup');
  });

  it('lets candidates submit a reschedule request for hiring interviews', async () => {
    const hiringInterview = {
      id: 'interview_hiring_1',
      status: 'SCHEDULED',
      mode: 'HIRING',
      company: { companyName: 'Globex' },
      jobRole: 'Frontend Engineer',
      interviewType: 'Hiring',
      interviewerName: 'Casey',
      scheduledFor: futureIso(11, 9, 0),
      duration: '60 min',
    };

    render(
      <SchedulingWidget
        upcomingInterviews={[hiringInterview]}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Reschedule' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Request Reschedule' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Request Reschedule' }));
    const textarea = document.querySelector('textarea');
    expect(textarea).not.toBeNull();
    fireEvent.change(textarea, {
      target: { value: 'I have an unavoidable exam and need a different interview slot this week.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));

    await waitFor(() => {
      expect(apiClient.interviews.requestReschedule).toHaveBeenCalledTimes(1);
    });

    const [id, payload] = apiClient.interviews.requestReschedule.mock.calls[0];
    expect(id).toBe('interview_hiring_1');
    expect(payload.reason.toLowerCase()).toContain('exam');
    expect(apiClient.interviews.schedule).not.toHaveBeenCalled();
    expect(apiClient.interviews.reschedule).not.toHaveBeenCalled();
  });

  it('shows the email-link notice instead of a direct join button for hiring interviews before the scheduled start time', () => {
    const hiringInterview = {
      id: 'interview_hiring_2',
      status: 'SCHEDULED',
      mode: 'HIRING',
      company: { companyName: 'Globex' },
      jobRole: 'Frontend Engineer',
      interviewType: 'Hiring',
      interviewerName: 'Casey',
      scheduledFor: futureIso(11, 9, 0),
      duration: '60 min',
    };

    render(<SchedulingWidget upcomingInterviews={[hiringInterview]} />);

    expect(screen.queryByRole('button', { name: 'Join' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Join Meeting' })).toBeNull();
    expect(screen.getByText('Join link is emailed 30 minutes before start')).toBeTruthy();
  });

  it('prefers the interview organization over the assigned recruiter summary when rendering the company name', () => {
    const hiringInterview = {
      id: 'interview_hiring_org_1',
      status: 'SCHEDULED',
      mode: 'HIRING',
      company: { fullName: 'Recruiter UI Test' },
      organization: { displayName: 'Cynectex', logo: '/logos/cynectex.png' },
      jobRole: 'Data Analyst',
      interviewType: 'Hiring',
      scheduledFor: futureIso(11, 9, 0),
      duration: '60 min',
    };

    render(<SchedulingWidget upcomingInterviews={[hiringInterview]} />);

    expect(screen.getByText('Cynectex')).toBeTruthy();
    expect(screen.queryByText('Recruiter UI Test')).toBeNull();
  });

  it('shows the current interview round context on candidate interview cards', () => {
    const hiringInterview = {
      id: 'interview_hiring_round_1',
      status: 'SCHEDULED',
      mode: 'HIRING',
      organization: { displayName: 'Cynectex' },
      jobRole: 'Data Analyst',
      interviewType: 'Hiring',
      scheduledFor: futureIso(11, 9, 0),
      duration: '60 min',
      planStageSequence: 2,
      planStageTotal: 3,
      planStageName: 'SME Interview',
      planStageCategory: 'TECHNICAL',
    };

    render(<SchedulingWidget upcomingInterviews={[hiringInterview]} />);

    expect(screen.getByText('Round 2 of 3')).toBeTruthy();
    expect(screen.getByText('SME Interview')).toBeTruthy();
  });

  it('keeps exhausted hiring interview actions stacked cleanly for mobile layouts', () => {
    const exhaustedHiringInterview = {
      id: 'interview_hiring_3',
      status: 'SCHEDULED',
      mode: 'HIRING',
      company: { companyName: 'Globex' },
      jobRole: 'Frontend Engineer',
      interviewType: 'Hiring',
      interviewerName: 'Casey',
      scheduledFor: futureIso(11, 9, 0),
      duration: '60 min',
      rescheduleRequests: [
        {
          id: 'request_1',
          status: 'APPROVED',
        },
      ],
    };

    render(<SchedulingWidget upcomingInterviews={[exhaustedHiringInterview]} />);

    const contactButton = screen.getByRole('button', { name: 'Contact Company' });
    const actionGroup = contactButton.parentElement;
    const noticeChip = screen.getByText('Join link is emailed 30 minutes before start');

    expect(actionGroup?.className || '').toContain('flex-col');
    expect(actionGroup?.className || '').toContain('sm:flex-row');
    expect(contactButton.className).toContain('w-full');
    expect(contactButton.className).toContain('sm:w-auto');
    expect(noticeChip.className).toContain('w-full');
    expect(noticeChip.className).toContain('whitespace-normal');
    expect(noticeChip.className).toContain('sm:w-auto');
  });

  it('shows a direct Join Meeting button for hiring interviews once the scheduled start time arrives', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T09:05:00.000Z'));

    const hiringInterview = {
      id: 'interview_hiring_2',
      status: 'SCHEDULED',
      mode: 'HIRING',
      company: { companyName: 'Globex' },
      jobRole: 'Frontend Engineer',
      interviewType: 'Hiring',
      interviewerName: 'Casey',
      scheduledFor: '2026-03-11T09:00:00.000Z',
      duration: '60 min',
    };

    render(<SchedulingWidget upcomingInterviews={[hiringInterview]} />);

    expect(screen.queryByText('Join link is emailed 30 minutes before start')).toBeNull();
    expect(screen.getByText('Live Now')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Join Interview Now' }));

    expect(mockNavigate).toHaveBeenCalledWith('/live-interview-session?interviewId=interview_hiring_2');
  });

  it('does not keep a past scheduled hiring interview in the upcoming list after the join window has expired', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T11:05:00.000Z'));

    const hiringInterview = {
      id: 'interview_hiring_expired_1',
      status: 'SCHEDULED',
      mode: 'HIRING',
      company: { companyName: 'Globex' },
      jobRole: 'Frontend Engineer',
      interviewType: 'Hiring',
      interviewerName: 'Casey',
      scheduledFor: '2026-03-11T09:00:00.000Z',
      duration: '60 min',
    };

    render(<SchedulingWidget upcomingInterviews={[hiringInterview]} />);

    expect(screen.queryByText('Globex')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Join Interview Now' })).toBeNull();
    expect(screen.getByRole('button', { name: 'View Applications' })).toBeTruthy();
  });

  it('blocks reschedule requests when the preferred slot is in the past', async () => {
    const hiringInterview = {
      id: 'interview_hiring_1',
      status: 'SCHEDULED',
      mode: 'HIRING',
      company: { companyName: 'Globex' },
      jobRole: 'Frontend Engineer',
      interviewType: 'Hiring',
      interviewerName: 'Casey',
      scheduledFor: futureIso(11, 9, 0),
      duration: '60 min',
    };

    render(<SchedulingWidget upcomingInterviews={[hiringInterview]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Request Reschedule' }));
    fireEvent.change(document.querySelector('textarea'), {
      target: { value: 'I have an unavoidable exam and need a different interview slot this week.' },
    });
    fireEvent.change(document.querySelector('input[type="datetime-local"]'), {
      target: { value: toDateTimeLocal(new Date(Date.now() - (2 * 60 * 60 * 1000))) },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));

    await waitFor(() => {
      expect(screen.getByText('Preferred reschedule slot must be in the future.')).toBeTruthy();
    });
    expect(apiClient.interviews.requestReschedule).not.toHaveBeenCalled();
  });
});
