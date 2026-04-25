import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ScheduleInterviewModal from '../ScheduleInterviewModal.jsx';
import apiClient from '../../../services/apiClient.js';

vi.mock('../Button.jsx', () => ({
  default: ({ children, onClick, disabled, type = 'button', loading }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {loading ? 'Loading' : children}
    </button>
  ),
}));

vi.mock('../../AppIcon.jsx', () => ({
  default: () => <span data-testid="mock-icon" />,
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
}));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    organizations: {
      listMembers: vi.fn(),
    },
    interviews: {
      getInterview: vi.fn(),
      schedule: vi.fn(),
      reschedule: vi.fn(),
    },
  },
}));

const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const toLocalDatetimeValue = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const nextLocalWeekdayValue = (weekday, hour, minute, minimumDaysAhead = 3) => {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setDate(date.getDate() + minimumDaysAhead);
  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() + 1);
  }
  date.setHours(hour, minute, 0, 0);
  return toLocalDatetimeValue(date);
};

describe('ScheduleInterviewModal', () => {
  beforeEach(() => {
    apiClient.organizations.listMembers.mockReset();
    apiClient.interviews.getInterview.mockReset();
    apiClient.interviews.schedule.mockReset();
    apiClient.interviews.reschedule.mockReset();
    apiClient.organizations.listMembers.mockResolvedValue({
      success: true,
      members: [
        {
          userId: 'reviewer-1',
          role: 'REVIEWER',
          status: 'ACTIVE',
          user: { id: 'reviewer-1', fullName: 'Reviewer One', email: 'reviewer1@example.com' },
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('uses a viewport-safe dialog shell for long scheduling content', () => {
    render(
      <ScheduleInterviewModal
        interview={{
          id: 'int-layout',
          mode: 'HIRING',
          duration: 30,
          timezone: localTimezone,
        }}
        isOpen={true}
        onClose={vi.fn()}
        onScheduled={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Schedule Interview' });

    expect(dialog.className).toContain('max-w-2xl');
    expect(dialog.className).toContain('max-h-[calc(100vh-1.5rem)]');
    expect(dialog.className).toContain('overflow-y-auto');
    expect(dialog.parentElement.className).toContain('overflow-y-auto');
  });

  it('blocks manual scheduling outside recruiter availability before submit', async () => {
    apiClient.interviews.getInterview.mockResolvedValue({
      success: true,
      interview: {
        id: 'int-1',
        schedulingConstraints: {
          timezone: localTimezone,
          leadHours: 1,
          slotMinutes: 30,
          scheduleWindowDays: 30,
          durationMinutes: 30,
          workingDays: [1],
          businessHoursStartMinutes: 9 * 60,
          businessHoursEndMinutes: 10 * 60,
          availabilitySource: 'RECRUITER',
          assignedRecruiterId: 'recruiter-1',
          assignedRecruiterName: 'Recruiter One',
        },
      },
    });

    render(
      <ScheduleInterviewModal
        interview={{
          id: 'int-1',
          mode: 'HIRING',
          duration: 30,
          timezone: localTimezone,
        }}
        isOpen={true}
        onClose={vi.fn()}
        onScheduled={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(apiClient.interviews.getInterview).toHaveBeenCalledWith('int-1');
    });
    await waitFor(() => {
      expect(screen.getByText("Recruiter One's availability")).toBeTruthy();
    });
    expect(screen.getByText(/No manual meeting link is needed/i)).toBeTruthy();

    const datetimeInput = document.querySelector('input[type="datetime-local"]');
    expect(datetimeInput).not.toBeNull();
    fireEvent.change(datetimeInput, {
      target: { value: nextLocalWeekdayValue(1, 12, 0) },
    });

    expect(screen.getByRole('button', { name: 'Schedule' }).disabled).toBe(true);
    expect(
      screen.getByText(`Selected time must be within 09:00-10:00 ${localTimezone}.`),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));

    expect(apiClient.interviews.schedule).not.toHaveBeenCalled();
    expect(apiClient.interviews.reschedule).not.toHaveBeenCalled();
  });

  it('shows guided valid slots and applies a selected suggestion to the datetime input', async () => {
    apiClient.interviews.getInterview.mockResolvedValue({
      success: true,
      interview: {
        id: 'int-2',
        schedulingConstraints: {
          timezone: localTimezone,
          leadHours: 1,
          slotMinutes: 30,
          scheduleWindowDays: 30,
          durationMinutes: 30,
          workingDays: [1],
          businessHoursStartMinutes: 9 * 60,
          businessHoursEndMinutes: 11 * 60,
          availabilitySource: 'RECRUITER',
          assignedRecruiterId: 'recruiter-2',
          assignedRecruiterName: 'Recruiter Two',
        },
      },
    });

    render(
      <ScheduleInterviewModal
        interview={{
          id: 'int-2',
          mode: 'HIRING',
          duration: 30,
          timezone: localTimezone,
          scheduledFor: new Date(nextLocalWeekdayValue(2, 14, 0)).toISOString(),
        }}
        isOpen={true}
        onClose={vi.fn()}
        onScheduled={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Next valid slots')).toBeTruthy();
    });

    const datetimeInput = screen.getByLabelText('Date & Time');
    const initialValue = datetimeInput.value;
    const suggestionButtons = screen.getAllByRole('button', { name: /Use suggested slot /i });

    expect(suggestionButtons.length).toBeGreaterThan(0);

    fireEvent.click(suggestionButtons[0]);

    expect(datetimeInput.value).not.toBe(initialValue);
    expect(screen.getByRole('button', { name: 'Reschedule' }).disabled).toBe(false);
  });

  it('includes reviewer assignments when submitting a scheduled interview', async () => {
    apiClient.interviews.getInterview.mockResolvedValue({
      success: true,
      interview: {
        id: 'int-3',
        schedulingConstraints: {
          timezone: localTimezone,
          leadHours: 1,
          slotMinutes: 30,
          scheduleWindowDays: 30,
          durationMinutes: 30,
          workingDays: [1, 2, 3, 4, 5],
          businessHoursStartMinutes: 9 * 60,
          businessHoursEndMinutes: 17 * 60,
          availabilitySource: 'RECRUITER',
          assignedRecruiterId: 'recruiter-3',
          assignedRecruiterName: 'Recruiter Three',
        },
      },
    });
    apiClient.interviews.schedule.mockResolvedValue({
      success: true,
      interview: {
        id: 'int-3',
        scheduledFor: new Date(nextLocalWeekdayValue(1, 9, 0)).toISOString(),
      },
    });

    render(
      <ScheduleInterviewModal
        interview={{
          id: 'int-3',
          mode: 'HIRING',
          duration: 30,
          timezone: localTimezone,
        }}
        isOpen={true}
        onClose={vi.fn()}
        onScheduled={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Reviewer One')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Date & Time'), {
      target: { value: nextLocalWeekdayValue(1, 9, 0) },
    });
    fireEvent.click(screen.getByRole('button', { name: /Reviewer One/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));

    await waitFor(() => {
      expect(apiClient.interviews.schedule).toHaveBeenCalledWith(
        'int-3',
        expect.objectContaining({
          reviewerAssignments: ['reviewer-1'],
        }),
      );
    });
  });
});
