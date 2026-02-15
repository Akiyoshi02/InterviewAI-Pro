import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INVITATION_FILTERS,
  buildInvitationFilterOptions,
  countActiveInvitationFilters,
  filterInvitations,
} from '../invitationFilters.js';

const NOW = new Date('2026-02-14T12:00:00.000Z');

const JOB_FIXTURES = [
  { id: 'job-a', title: 'Frontend Engineer' },
  { id: 'job-b', title: 'Data Analyst' },
];

const INVITATION_FIXTURES = [
  {
    id: 'inv-1',
    email: 'alice@example.com',
    jobId: 'job-a',
    stage: 'SCREENING',
    status: 'PENDING',
    createdAt: '2026-02-13T09:00:00.000Z',
    updatedAt: '2026-02-13T09:00:00.000Z',
    expiresAt: '2026-02-20T09:00:00.000Z',
    acceptanceInProgress: false,
    candidateUserId: null,
  },
  {
    id: 'inv-2',
    email: 'ben@example.com',
    jobId: 'job-b',
    stage: 'INTERVIEW',
    status: 'PENDING',
    createdAt: '2026-02-12T10:00:00.000Z',
    updatedAt: '2026-02-12T10:00:00.000Z',
    expiresAt: '2026-02-15T10:00:00.000Z',
    acceptanceInProgress: true,
  },
  {
    id: 'inv-3',
    email: 'clara@example.com',
    jobId: 'job-b',
    stage: 'FINAL',
    status: 'ACCEPTED',
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-01-10T12:00:00.000Z',
    acceptedInterviewId: 'int-77',
    acceptedApplicationId: 'app-77',
    candidateUserId: 'cand-77',
  },
  {
    id: 'inv-4',
    email: 'derek@example.com',
    jobId: 'job-x',
    stage: 'TECHNICAL_SCREEN',
    status: 'PENDING',
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
    expiresAt: '2026-01-10T09:00:00.000Z',
  },
  {
    id: 'inv-5',
    email: 'erica@example.com',
    jobId: 'job-a',
    stage: 'SCREENING',
    status: 'REVOKED',
    createdAt: '2025-12-10T11:00:00.000Z',
    updatedAt: '2025-12-10T11:00:00.000Z',
  },
];

describe('invitationFilters', () => {
  it('derives lifecycle states and time-based expiry for pending invitations', () => {
    const inProgress = filterInvitations(
      INVITATION_FIXTURES,
      { ...DEFAULT_INVITATION_FILTERS, lifecycleFilter: 'IN_PROGRESS' },
      { jobs: JOB_FIXTURES, now: NOW },
    );
    expect(inProgress.map((item) => item.invitation.id)).toEqual(['inv-2']);

    const expired = filterInvitations(
      INVITATION_FIXTURES,
      { ...DEFAULT_INVITATION_FILTERS, statusFilter: 'EXPIRED' },
      { jobs: JOB_FIXTURES, now: NOW },
    );
    expect(expired.map((item) => item.invitation.id)).toEqual(['inv-4']);
  });

  it('supports candidate-link and accepted-with-interview lifecycle filters', () => {
    const linked = filterInvitations(
      INVITATION_FIXTURES,
      { ...DEFAULT_INVITATION_FILTERS, candidateLinkFilter: 'linked' },
      { jobs: JOB_FIXTURES, now: NOW },
    );
    expect(linked.map((item) => item.invitation.id)).toEqual(['inv-3']);

    const acceptedWithInterview = filterInvitations(
      INVITATION_FIXTURES,
      { ...DEFAULT_INVITATION_FILTERS, lifecycleFilter: 'ACCEPTED_WITH_INTERVIEW' },
      { jobs: JOB_FIXTURES, now: NOW },
    );
    expect(acceptedWithInterview.map((item) => item.invitation.id)).toEqual(['inv-3']);
  });

  it('matches search text across email, job title, status, and stage labels', () => {
    const results = filterInvitations(
      INVITATION_FIXTURES,
      { ...DEFAULT_INVITATION_FILTERS, searchQuery: 'alice frontend screening pending' },
      { jobs: JOB_FIXTURES, now: NOW },
    );
    expect(results.map((item) => item.invitation.id)).toEqual(['inv-1']);
  });

  it('applies date presets and custom sent-date windows', () => {
    const lastThirty = filterInvitations(
      INVITATION_FIXTURES,
      { ...DEFAULT_INVITATION_FILTERS, datePreset: 'last30' },
      { jobs: JOB_FIXTURES, now: NOW },
    );
    expect(lastThirty.map((item) => item.invitation.id)).toEqual(['inv-1', 'inv-2']);

    const customRange = filterInvitations(
      INVITATION_FIXTURES,
      {
        ...DEFAULT_INVITATION_FILTERS,
        datePreset: 'custom',
        sentFrom: '2026-02-12',
        sentTo: '2026-02-13',
      },
      { jobs: JOB_FIXTURES, now: NOW },
    );
    expect(customRange.map((item) => item.invitation.id)).toEqual(['inv-1', 'inv-2']);
  });

  it('sorts by status priority and expiry windows', () => {
    const prioritySorted = filterInvitations(
      INVITATION_FIXTURES,
      { ...DEFAULT_INVITATION_FILTERS, sortBy: 'status_priority' },
      { jobs: JOB_FIXTURES, now: NOW },
    );
    expect(prioritySorted.map((item) => item.invitation.id)).toEqual(['inv-1', 'inv-2', 'inv-3', 'inv-4', 'inv-5']);

    const expiresSoon = filterInvitations(
      INVITATION_FIXTURES,
      { ...DEFAULT_INVITATION_FILTERS, sortBy: 'expires_soon' },
      { jobs: JOB_FIXTURES, now: NOW },
    );
    expect(expiresSoon.map((item) => item.invitation.id).slice(0, 2)).toEqual(['inv-2', 'inv-1']);
  });

  it('builds dynamic stage and job options from jobs and invitation history', () => {
    const options = buildInvitationFilterOptions(INVITATION_FIXTURES, JOB_FIXTURES, { now: NOW });
    expect(options.jobOptions.some((item) => item.value === 'job-x')).toBe(true);
    expect(options.stageOptions.some((item) => item.value === 'TECHNICAL_SCREEN')).toBe(true);
    expect(options.stageOptions.some((item) => item.value === 'SCREENING')).toBe(true);
  });

  it('counts active filters relative to defaults', () => {
    expect(countActiveInvitationFilters(DEFAULT_INVITATION_FILTERS)).toBe(0);
    expect(
      countActiveInvitationFilters({
        ...DEFAULT_INVITATION_FILTERS,
        searchQuery: 'frontend',
        lifecycleFilter: 'AWAITING_CANDIDATE',
        datePreset: 'last30',
      }),
    ).toBe(3);
  });
});
