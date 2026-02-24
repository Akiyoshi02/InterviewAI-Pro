import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CANDIDATE_APPLICATION_FILTERS,
  buildCandidateApplicationFilterOptions,
  countActiveCandidateFilters,
  filterCandidateApplications,
  getDerivedApplicationStatus,
  groupCandidateApplicationsByJob,
} from '../candidateApplicationFilters.js';

const NOW = new Date('2026-02-13T12:00:00.000Z');

const APPLICATION_FIXTURES = [
  {
    id: 'app-1',
    status: 'SUBMITTED',
    submittedAt: '2026-02-12T10:00:00.000Z',
    createdAt: '2026-02-12T10:00:00.000Z',
    job: {
      id: 'job-a',
      title: 'Frontend Engineer',
      department: 'Product',
      location: 'São Paulo',
      employmentType: 'FULL_TIME',
    },
    organization: { name: 'Acme Labs' },
  },
  {
    id: 'app-2',
    status: 'REJECTED',
    withdrawnBy: 'candidate-123',
    submittedAt: '2026-01-10T11:00:00.000Z',
    createdAt: '2026-01-10T11:00:00.000Z',
    job: {
      id: 'job-b',
      title: 'Data Analyst',
      location: 'Berlin',
      employmentType: 'CONTRACT',
    },
    organization: { name: 'Beta Group' },
  },
  {
    id: 'app-3',
    status: 'REJECTED',
    dispositionCode: 'JOB_CLOSED',
    submittedAt: '2025-12-15T08:00:00.000Z',
    createdAt: '2025-12-15T08:00:00.000Z',
    job: {
      id: 'job-c',
      title: 'ML Engineer',
      isDeleted: true,
      employmentType: 'PART_TIME',
    },
    organization: { name: 'Gamma Tech' },
  },
  {
    id: 'app-4',
    status: 'REJECTED',
    submittedAt: '2026-02-01T09:00:00.000Z',
    createdAt: '2026-02-01T09:00:00.000Z',
    reviewedAt: '2026-02-02T09:00:00.000Z',
    job: {
      id: 'job-a',
      title: 'Frontend Engineer',
      location: 'Lisbon',
      employmentType: 'FULL_TIME',
    },
    organization: { name: 'Acme Labs' },
  },
  {
    id: 'app-5',
    status: 'HIRED',
    submittedAt: '2025-10-05T07:00:00.000Z',
    createdAt: '2025-10-05T07:00:00.000Z',
    reviewedAt: '2025-11-01T12:00:00.000Z',
    job: {
      id: 'job-d',
      title: 'Engineering Manager',
      location: 'Remote',
      employmentType: 'FULL_TIME',
    },
    organization: { name: 'Delta Inc' },
  },
  {
    id: 'app-6',
    status: 'INTERVIEWING',
    submittedAt: '2026-02-05T10:00:00.000Z',
    createdAt: '2026-02-05T10:00:00.000Z',
    job: {
      id: 'job-e',
      title: 'UI Engineer',
      location: 'London',
      employmentType: 'PART_TIME',
    },
    organization: { name: 'Acme Labs' },
  },
];

describe('candidateApplicationFilters', () => {
  it('derives withdrawn and position-closed states from rejected applications', () => {
    expect(getDerivedApplicationStatus(APPLICATION_FIXTURES[1])).toBe('WITHDRAWN');
    expect(getDerivedApplicationStatus(APPLICATION_FIXTURES[2])).toBe('POSITION_CLOSED');
    expect(getDerivedApplicationStatus(APPLICATION_FIXTURES[3])).toBe('REJECTED');
  });

  it('filters by active/final status groups and inferred disposition codes', () => {
    const active = filterCandidateApplications(
      APPLICATION_FIXTURES,
      { ...DEFAULT_CANDIDATE_APPLICATION_FILTERS, statusFilter: 'ACTIVE' },
      { now: NOW },
    );
    const activeIds = active.map((item) => item.id);
    expect(activeIds).toEqual(['app-1', 'app-6']);

    const withdrew = filterCandidateApplications(
      APPLICATION_FIXTURES,
      { ...DEFAULT_CANDIDATE_APPLICATION_FILTERS, dispositionFilter: 'CANDIDATE_WITHDREW' },
      { now: NOW },
    );
    expect(withdrew.map((item) => item.id)).toEqual(['app-2']);
  });

  it('handles text normalization and accent-insensitive search matching', () => {
    const results = filterCandidateApplications(
      APPLICATION_FIXTURES,
      { ...DEFAULT_CANDIDATE_APPLICATION_FILTERS, searchQuery: 'sao acme frontend' },
      { now: NOW },
    );
    expect(results.map((item) => item.id)).toEqual(['app-1']);
  });

  it('applies date presets and custom date windows correctly', () => {
    const lastThirtyDays = filterCandidateApplications(
      APPLICATION_FIXTURES,
      { ...DEFAULT_CANDIDATE_APPLICATION_FILTERS, datePreset: 'last30' },
      { now: NOW },
    );
    expect(lastThirtyDays.map((item) => item.id)).toEqual(['app-1', 'app-6', 'app-4']);

    const customRange = filterCandidateApplications(
      APPLICATION_FIXTURES,
      {
        ...DEFAULT_CANDIDATE_APPLICATION_FILTERS,
        datePreset: 'custom',
        appliedFrom: '2026-02-01',
        appliedTo: '2026-02-12',
      },
      { now: NOW },
    );
    expect(customRange.map((item) => item.id)).toEqual(['app-1', 'app-6', 'app-4']);
  });

  it('supports review, job-state, and withdrawal availability filters', () => {
    const reviewed = filterCandidateApplications(
      APPLICATION_FIXTURES,
      { ...DEFAULT_CANDIDATE_APPLICATION_FILTERS, reviewStateFilter: 'REVIEWED' },
      { now: NOW },
    );
    expect(reviewed.map((item) => item.id)).toEqual(['app-4', 'app-5']);

    const closedJobs = filterCandidateApplications(
      APPLICATION_FIXTURES,
      { ...DEFAULT_CANDIDATE_APPLICATION_FILTERS, jobStateFilter: 'CLOSED' },
      { now: NOW },
    );
    expect(closedJobs.map((item) => item.id)).toEqual(['app-3']);

    const withdrawable = filterCandidateApplications(
      APPLICATION_FIXTURES,
      { ...DEFAULT_CANDIDATE_APPLICATION_FILTERS, withdrawalFilter: 'WITHDRAWABLE' },
      { now: NOW },
    );
    expect(withdrawable.map((item) => item.id)).toEqual(['app-1']);
  });

  it('groups filtered applications by job while preserving counts', () => {
    const filtered = filterCandidateApplications(
      APPLICATION_FIXTURES,
      { ...DEFAULT_CANDIDATE_APPLICATION_FILTERS, statusFilter: 'FINAL' },
      { now: NOW },
    );
    const groups = groupCandidateApplicationsByJob(filtered, { sortBy: 'latest_activity' });
    const jobAGroup = groups.find((group) => group.jobId === 'job-a');

    expect(groups.length).toBe(4);
    expect(jobAGroup).toBeTruthy();
    expect(jobAGroup.filteredCount).toBe(1);
  });

  it('builds dynamic options for company, employment type, and outcomes', () => {
    const options = buildCandidateApplicationFilterOptions(APPLICATION_FIXTURES);

    expect(options.companyOptions.some((item) => item.value === 'Acme Labs')).toBe(true);
    expect(options.employmentTypeOptions.some((item) => item.value === 'PART_TIME')).toBe(true);
    expect(options.dispositionOptions.some((item) => item.value === 'JOB_CLOSED')).toBe(true);
    expect(options.dispositionOptions.some((item) => item.value === 'CANDIDATE_WITHDREW')).toBe(true);
  });

  it('counts active filters relative to defaults', () => {
    expect(countActiveCandidateFilters(DEFAULT_CANDIDATE_APPLICATION_FILTERS)).toBe(0);
    expect(
      countActiveCandidateFilters({
        ...DEFAULT_CANDIDATE_APPLICATION_FILTERS,
        searchQuery: 'frontend',
        statusFilter: 'ACTIVE',
        datePreset: 'last30',
      }),
    ).toBe(3);
  });
});

