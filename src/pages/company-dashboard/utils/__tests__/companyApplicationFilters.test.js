import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMPANY_APPLICATION_FILTERS,
  buildCompanyApplicationFilterOptions,
  countActiveCompanyFilters,
  filterCompanyApplications,
  getDerivedApplicationStatus,
  groupCompanyApplicationsByJob,
} from '../companyApplicationFilters.js';

const NOW = new Date('2026-02-13T12:00:00.000Z');

const APPLICATION_FIXTURES = [
  {
    id: 'app-1',
    status: 'SUBMITTED',
    submittedAt: '2026-02-12T10:00:00.000Z',
    createdAt: '2026-02-12T10:00:00.000Z',
    candidate: {
      fullName: 'Alice Johnson',
      email: 'alice@example.com',
    },
    job: {
      id: 'job-a',
      title: 'Frontend Engineer',
      department: 'Product',
      location: 'Remote',
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
    candidate: {
      fullName: 'Ben Wright',
      email: 'ben@example.com',
    },
    job: {
      id: 'job-b',
      title: 'Data Analyst',
      location: 'Berlin',
      employmentType: 'CONTRACT',
    },
    organization: { name: 'Acme Labs' },
  },
  {
    id: 'app-3',
    status: 'REJECTED',
    dispositionCode: 'JOB_CLOSED',
    submittedAt: '2025-12-15T08:00:00.000Z',
    createdAt: '2025-12-15T08:00:00.000Z',
    candidate: {
      fullName: 'Clara Smith',
      email: 'clara@example.com',
    },
    job: {
      id: 'job-c',
      title: 'ML Engineer',
      isDeleted: true,
      employmentType: 'PART_TIME',
    },
    organization: { name: 'Beta Group' },
  },
  {
    id: 'app-4',
    status: 'REJECTED',
    submittedAt: '2026-02-01T09:00:00.000Z',
    createdAt: '2026-02-01T09:00:00.000Z',
    reviewedAt: '2026-02-02T09:00:00.000Z',
    candidate: {
      fullName: 'Derek Prince',
      email: 'derek@example.com',
    },
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
    candidate: {
      fullName: 'Ema Kline',
      email: 'ema@example.com',
    },
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
    candidate: {
      fullName: 'Frank Moore',
      email: 'frank@example.com',
    },
    job: {
      id: 'job-e',
      title: 'UI Engineer',
      location: 'London',
      employmentType: 'PART_TIME',
    },
    organization: { name: 'Gamma Tech' },
  },
  {
    id: 'app-7',
    status: 'OFFER',
    submittedAt: '2026-02-06T09:30:00.000Z',
    createdAt: '2026-02-06T09:30:00.000Z',
    reviewedAt: '2026-02-10T12:00:00.000Z',
    candidate: {
      fullName: 'Grace Perera',
      email: 'grace@example.com',
    },
    job: {
      id: 'job-f',
      title: 'Platform Engineer',
      location: 'Colombo',
      employmentType: 'FULL_TIME',
    },
    organization: { name: 'Cynectex' },
  },
];

describe('companyApplicationFilters', () => {
  it('derives withdrawn and position-closed statuses from rejected applications', () => {
    expect(getDerivedApplicationStatus(APPLICATION_FIXTURES[1])).toBe('WITHDRAWN');
    expect(getDerivedApplicationStatus(APPLICATION_FIXTURES[2])).toBe('POSITION_CLOSED');
    expect(getDerivedApplicationStatus(APPLICATION_FIXTURES[3])).toBe('REJECTED');
  });

  it('filters by status groups and inferred disposition codes', () => {
    const active = filterCompanyApplications(
      APPLICATION_FIXTURES,
      { ...DEFAULT_COMPANY_APPLICATION_FILTERS, statusFilter: 'ACTIVE' },
      { now: NOW },
    );
    expect(active.map((item) => item.id)).toEqual(['app-1', 'app-7', 'app-6']);

    const withdrew = filterCompanyApplications(
      APPLICATION_FIXTURES,
      { ...DEFAULT_COMPANY_APPLICATION_FILTERS, dispositionFilter: 'CANDIDATE_WITHDREW' },
      { now: NOW },
    );
    expect(withdrew.map((item) => item.id)).toEqual(['app-2']);
  });

  it('matches candidate and role text in search queries', () => {
    const results = filterCompanyApplications(
      APPLICATION_FIXTURES,
      { ...DEFAULT_COMPANY_APPLICATION_FILTERS, searchQuery: 'alice frontend remote' },
      { now: NOW },
    );
    expect(results.map((item) => item.id)).toEqual(['app-1']);
  });

  it('applies date presets and custom date windows', () => {
    const lastThirtyDays = filterCompanyApplications(
      APPLICATION_FIXTURES,
      { ...DEFAULT_COMPANY_APPLICATION_FILTERS, datePreset: 'last30' },
      { now: NOW },
    );
    expect(lastThirtyDays.map((item) => item.id)).toEqual(['app-1', 'app-7', 'app-6', 'app-4']);

    const customRange = filterCompanyApplications(
      APPLICATION_FIXTURES,
      {
        ...DEFAULT_COMPANY_APPLICATION_FILTERS,
        datePreset: 'custom',
        appliedFrom: '2026-02-01',
        appliedTo: '2026-02-12',
      },
      { now: NOW },
    );
    expect(customRange.map((item) => item.id)).toEqual(['app-1', 'app-7', 'app-6', 'app-4']);
  });

  it('supports review state, job state, and role filters', () => {
    const reviewed = filterCompanyApplications(
      APPLICATION_FIXTURES,
      { ...DEFAULT_COMPANY_APPLICATION_FILTERS, reviewStateFilter: 'REVIEWED' },
      { now: NOW },
    );
    expect(reviewed.map((item) => item.id)).toEqual(['app-7', 'app-4', 'app-5']);

    const closedJobs = filterCompanyApplications(
      APPLICATION_FIXTURES,
      { ...DEFAULT_COMPANY_APPLICATION_FILTERS, jobStateFilter: 'CLOSED' },
      { now: NOW },
    );
    expect(closedJobs.map((item) => item.id)).toEqual(['app-3']);

    const roleAOnly = filterCompanyApplications(
      APPLICATION_FIXTURES,
      { ...DEFAULT_COMPANY_APPLICATION_FILTERS, jobFilter: 'job-a' },
      { now: NOW },
    );
    expect(roleAOnly.map((item) => item.id)).toEqual(['app-1', 'app-4']);
  });

  it('groups filtered applications by role with derived status counts', () => {
    const filtered = filterCompanyApplications(
      APPLICATION_FIXTURES,
      { ...DEFAULT_COMPANY_APPLICATION_FILTERS, statusFilter: 'FINAL' },
      { now: NOW },
    );
    const groups = groupCompanyApplicationsByJob(filtered, { sortBy: 'latest_activity' });
    const jobAGroup = groups.find((group) => group.jobId === 'job-a');

    expect(groups.length).toBe(4);
    expect(jobAGroup).toBeTruthy();
    expect(jobAGroup.filteredCount).toBe(1);
    expect(jobAGroup.stats.rejected).toBe(1);
  });

  it('builds role, company, employment, and outcome options dynamically', () => {
    const availableJobs = [
      { id: 'job-a', title: 'Frontend Engineer' },
      { id: 'job-z', title: 'Platform Engineer' },
    ];
    const options = buildCompanyApplicationFilterOptions(APPLICATION_FIXTURES, availableJobs);

    expect(options.jobOptions.some((item) => item.value === 'job-z')).toBe(true);
    expect(options.companyOptions.some((item) => item.value === 'Acme Labs')).toBe(true);
    expect(options.employmentTypeOptions.some((item) => item.value === 'PART_TIME')).toBe(true);
    expect(options.dispositionOptions.some((item) => item.value === 'JOB_CLOSED')).toBe(true);
    expect(options.dispositionOptions.some((item) => item.value === 'CANDIDATE_WITHDREW')).toBe(true);
  });

  it('counts active filters relative to defaults', () => {
    expect(countActiveCompanyFilters(DEFAULT_COMPANY_APPLICATION_FILTERS)).toBe(0);
    expect(
      countActiveCompanyFilters({
        ...DEFAULT_COMPANY_APPLICATION_FILTERS,
        searchQuery: 'frontend',
        statusFilter: 'ACTIVE',
        datePreset: 'last30',
      }),
    ).toBe(3);
  });
});
