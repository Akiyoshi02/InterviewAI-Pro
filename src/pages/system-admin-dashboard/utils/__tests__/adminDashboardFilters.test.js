import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADMIN_ANALYTICS_DATASET_FILTERS,
  DEFAULT_ADMIN_APPROVAL_FILTERS,
  DEFAULT_ADMIN_AUDIT_FILTERS,
  DEFAULT_ADMIN_INTERVIEW_DATASET_FILTERS,
  DEFAULT_ADMIN_LIVE_CHAT_FILTERS,
  DEFAULT_ADMIN_ORGANIZATION_FILTERS,
  DEFAULT_ADMIN_USER_FILTERS,
  countActiveAdminAuditFilters,
  countActiveAdminLiveChatFilters,
  countActiveAdminOrganizationFilters,
  countActiveAdminUserFilters,
  countActiveAnalyticsDatasetFilters,
  countActiveApprovalFilters,
  countActiveInterviewDatasetFilters,
  filterAdminAuditLogs,
  filterAdminLiveChats,
  filterAdminOrganizations,
  filterAdminUsers,
  filterAnalyticsDatasets,
  filterInterviewDatasets,
  filterPendingApprovalOrganizations,
} from '../adminDashboardFilters.js';

const NOW = new Date('2026-02-13T12:00:00.000Z');

const ORGANIZATIONS = [
  {
    id: 'org-1',
    status: 'PENDING',
    displayName: 'Acme Labs',
    industry: 'Technology',
    companySize: '51-200',
    createdAt: '2026-02-10T09:00:00.000Z',
    reReviewRequestedAt: null,
    reReviewRequestCount: 0,
    owner: { fullName: 'Alice', email: 'alice@acme.com' },
  },
  {
    id: 'org-2',
    status: 'PENDING',
    displayName: 'Beta Works',
    industry: 'Finance',
    companySize: '11-50',
    createdAt: '2025-12-10T09:00:00.000Z',
    reReviewRequestedAt: '2026-01-05T09:00:00.000Z',
    reReviewRequestCount: 2,
    owner: { fullName: 'Bob', email: 'bob@gmail.com' },
  },
  {
    id: 'org-3',
    status: 'SUSPENDED',
    displayName: 'Gamma Retail',
    industry: 'Retail',
    companySize: '201-500',
    createdAt: '2025-11-01T09:00:00.000Z',
    reReviewRequestCount: 1,
    owner: { fullName: 'Caro', email: '' },
  },
];

const USERS = [
  {
    id: 'user-1',
    fullName: 'Alice Candidate',
    email: 'alice@gmail.com',
    accountType: 'CANDIDATE',
    accountStatus: 'ACTIVE',
    createdAt: '2026-02-10T09:00:00.000Z',
    organization: null,
  },
  {
    id: 'user-2',
    fullName: 'Ben Recruiter',
    email: 'ben@acme.com',
    accountType: 'COMPANY',
    accountStatus: 'SUSPENDED',
    createdAt: '2026-01-01T09:00:00.000Z',
    suspendedAt: '2026-01-20T00:00:00.000Z',
    suspensionReason: 'Policy violation',
    organization: { id: 'org-1', name: 'Acme Labs', status: 'APPROVED' },
  },
  {
    id: 'user-3',
    fullName: 'Cara Admin',
    email: 'cara@platform.io',
    accountType: 'SYSTEM_ADMIN',
    accountStatus: 'ACTIVE',
    createdAt: '2025-12-01T09:00:00.000Z',
    organization: null,
  },
];

const AUDIT_LOGS = [
  {
    id: 'log-1',
    action: 'ORG_APPROVED',
    actorType: 'SYSTEM_ADMIN',
    targetType: 'ORGANIZATION',
    targetId: 'org-1',
    createdAt: '2026-02-12T08:00:00.000Z',
    metadata: { organizationName: 'Acme Labs' },
  },
  {
    id: 'log-2',
    action: 'USER_SUSPENDED',
    actorType: 'SYSTEM_ADMIN',
    targetType: 'USER',
    targetId: 'user-2',
    createdAt: '2026-01-20T08:00:00.000Z',
    metadata: { reason: 'Policy violation' },
  },
  {
    id: 'log-3',
    action: 'SETTINGS_UPDATED',
    actorType: 'SYSTEM_ADMIN',
    targetType: 'SETTINGS',
    targetId: 'global',
    createdAt: '2025-12-01T08:00:00.000Z',
    metadata: {},
  },
];

const LIVE_CHATS = [
  {
    id: 'chat-1',
    status: 'open',
    lastMessageAt: '2026-02-13T09:00:00.000Z',
    lastMessagePreview: 'Need help',
    user: { accountType: 'CANDIDATE', displayName: 'Alice', email: 'alice@example.com' },
  },
  {
    id: 'chat-2',
    status: 'open',
    createdAt: '2026-01-01T09:00:00.000Z',
    respondedAt: '2026-01-01T10:00:00.000Z',
    user: { accountType: 'COMPANY', displayName: 'Beta HR', email: 'beta@co.com' },
  },
  {
    id: 'chat-3',
    status: 'closed',
    lastMessageAt: '2026-02-01T09:00:00.000Z',
    user: { accountType: 'ANONYMOUS', displayName: 'Guest' },
  },
];

const INTERVIEW_DATASETS = [
  {
    id: 'int-1',
    sessionId: 'S1',
    config: { jobRole: 'Frontend Engineer', experienceLevel: 'Mid', industry: 'Technology' },
    metadata: { createdAt: '2026-02-12T00:00:00.000Z', qualityScore: 90 },
    totalTurns: 30,
    totalQAPairs: 8,
  },
  {
    id: 'int-2',
    sessionId: 'S2',
    config: { jobRole: 'Data Analyst', experienceLevel: 'Junior', industry: 'Finance' },
    metadata: { createdAt: '2026-01-10T00:00:00.000Z', qualityScore: 55 },
    totalTurns: 20,
    totalQAPairs: 5,
  },
  {
    id: 'int-3',
    sessionId: 'S3',
    config: { jobRole: 'Data Analyst', experienceLevel: 'Junior', industry: 'Finance' },
    metadata: { createdAt: '2025-10-10T00:00:00.000Z', qualityScore: 35 },
    totalTurns: 10,
    totalQAPairs: 2,
  },
];

const ANALYTICS_DATASETS = [
  {
    id: 'ana-1',
    sessionId: 'A1',
    config: { enablePose: true, enableFace: true },
    metadata: { createdAt: '2026-02-12T00:00:00.000Z' },
    totalFrames: 800,
    duration: 120000,
  },
  {
    id: 'ana-2',
    sessionId: 'A2',
    config: { enablePose: false, enableFace: true },
    metadata: { createdAt: '2026-01-10T00:00:00.000Z' },
    totalFrames: 200,
    duration: 60000,
  },
];

describe('adminDashboardFilters', () => {
  it('filters organizations by re-review state and owner domain', () => {
    const results = filterAdminOrganizations(ORGANIZATIONS, {
      ...DEFAULT_ADMIN_ORGANIZATION_FILTERS,
      statusFilter: 'PENDING',
      reReviewFilter: 'MULTIPLE',
      ownerDomainFilter: 'FREE',
    }, { now: NOW });

    expect(results.map((item) => item.id)).toEqual(['org-2']);
  });

  it('filters users by status, organization presence, and suspension reason', () => {
    const results = filterAdminUsers(USERS, {
      ...DEFAULT_ADMIN_USER_FILTERS,
      statusFilter: 'SUSPENDED',
      organizationPresenceFilter: 'WITH_ORG',
      suspensionFilter: 'WITH_REASON',
    }, { now: NOW });

    expect(results.map((item) => item.id)).toEqual(['user-2']);
  });

  it('filters audit logs by category and date preset', () => {
    const results = filterAdminAuditLogs(AUDIT_LOGS, {
      ...DEFAULT_ADMIN_AUDIT_FILTERS,
      categoryFilter: 'ORGANIZATION',
      datePreset: 'last30',
    }, { now: NOW });

    expect(results.map((item) => item.id)).toEqual(['log-1']);
  });

  it('filters live chats by waiting state and activity window', () => {
    const results = filterAdminLiveChats(LIVE_CHATS, {
      ...DEFAULT_ADMIN_LIVE_CHAT_FILTERS,
      responseStateFilter: 'waiting',
      activityPreset: 'last7',
    }, { now: NOW });

    expect(results.map((item) => item.id)).toEqual(['chat-1']);
  });

  it('filters interview datasets by quality band and role', () => {
    const results = filterInterviewDatasets(INTERVIEW_DATASETS, {
      ...DEFAULT_ADMIN_INTERVIEW_DATASET_FILTERS,
      qualityBandFilter: 'HIGH',
      jobRoleFilter: 'Frontend Engineer',
    }, { now: NOW });

    expect(results.map((item) => item.id)).toEqual(['int-1']);
  });

  it('filters analytics datasets by pose flag and frame range', () => {
    const results = filterAnalyticsDatasets(ANALYTICS_DATASETS, {
      ...DEFAULT_ADMIN_ANALYTICS_DATASET_FILTERS,
      poseFilter: 'disabled',
      minFrames: 150,
      maxFrames: 250,
    }, { now: NOW });

    expect(results.map((item) => item.id)).toEqual(['ana-2']);
  });

  it('filters approval queue by computed priority', () => {
    const results = filterPendingApprovalOrganizations(ORGANIZATIONS, {
      ...DEFAULT_ADMIN_APPROVAL_FILTERS,
      priorityFilter: 'HIGH',
      ownerDomainFilter: 'FREE',
    }, { now: NOW });

    expect(results.map((item) => item.id)).toEqual(['org-2']);
  });

  it('counts active filters across all filter groups', () => {
    expect(countActiveAdminOrganizationFilters(DEFAULT_ADMIN_ORGANIZATION_FILTERS)).toBe(0);
    expect(countActiveAdminUserFilters({ ...DEFAULT_ADMIN_USER_FILTERS, statusFilter: 'SUSPENDED' })).toBe(1);
    expect(countActiveAdminAuditFilters({ ...DEFAULT_ADMIN_AUDIT_FILTERS, categoryFilter: 'USER' })).toBe(1);
    expect(countActiveAdminLiveChatFilters({ ...DEFAULT_ADMIN_LIVE_CHAT_FILTERS, responseStateFilter: 'waiting' })).toBe(1);
    expect(countActiveInterviewDatasetFilters({ ...DEFAULT_ADMIN_INTERVIEW_DATASET_FILTERS, qualityBandFilter: 'HIGH' })).toBe(1);
    expect(countActiveAnalyticsDatasetFilters({ ...DEFAULT_ADMIN_ANALYTICS_DATASET_FILTERS, minFrames: 100 })).toBe(1);
    expect(countActiveApprovalFilters({ ...DEFAULT_ADMIN_APPROVAL_FILTERS, priorityFilter: 'HIGH' })).toBe(1);
  });
});
