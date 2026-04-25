import { describe, expect, it } from 'vitest';
import {
  getCandidateActiveInterviews,
  getCandidateUpcomingScheduledInterviews,
  isCandidateInterviewStillRelevant,
  isInterviewAccessWindowOpen,
} from '../candidateInterviewWindows.js';

describe('candidateInterviewWindows', () => {
  it('treats an old scheduled interview as expired after duration plus grace', () => {
    const nowMs = Date.parse('2026-03-11T12:00:00.000Z');
    const interview = {
      status: 'SCHEDULED',
      scheduledFor: '2026-03-09T09:00:00.000Z',
      duration: 30,
    };

    expect(isCandidateInterviewStillRelevant(interview, nowMs)).toBe(false);
    expect(isInterviewAccessWindowOpen(interview, nowMs)).toBe(false);
  });

  it('keeps a currently active scheduled interview in the candidate active set', () => {
    const nowMs = Date.parse('2026-03-11T09:10:00.000Z');
    const interviews = [
      {
        id: 'expired',
        status: 'SCHEDULED',
        scheduledFor: '2026-03-09T09:00:00.000Z',
        duration: 30,
      },
      {
        id: 'current',
        status: 'SCHEDULED',
        scheduledFor: '2026-03-11T09:00:00.000Z',
        duration: 30,
      },
    ];

    expect(getCandidateActiveInterviews(interviews, nowMs).map((interview) => interview.id)).toEqual(['current']);
    expect(getCandidateUpcomingScheduledInterviews(interviews, nowMs).map((interview) => interview.id)).toEqual(['current']);
  });

  it('keeps unscheduled interview workflows out of the upcoming scheduled set', () => {
    const nowMs = Date.parse('2026-03-11T09:10:00.000Z');
    const interviews = [
      {
        id: 'pending-schedule',
        status: 'SCHEDULED',
        duration: 30,
      },
      {
        id: 'scheduled',
        status: 'SCHEDULED',
        scheduledFor: '2026-03-11T10:00:00.000Z',
        duration: 30,
      },
    ];

    expect(getCandidateActiveInterviews(interviews, nowMs).map((interview) => interview.id)).toEqual([
      'pending-schedule',
      'scheduled',
    ]);
    expect(getCandidateUpcomingScheduledInterviews(interviews, nowMs).map((interview) => interview.id)).toEqual([
      'scheduled',
    ]);
  });
});
