import { beforeEach, describe, expect, it, jest } from '@jest/globals';

process.env.JOB_QUEUE_MODE = 'INLINE';

const clone = (value) => JSON.parse(JSON.stringify(value));

const state = {
  jobs: new Map(),
  applications: new Map(),
  invitations: new Map(),
  interviews: new Map(),
  organizations: new Map(),
  users: new Map(),
  activityLogs: [],
};

let idCounter = 0;
const nextId = (prefix) => `${prefix}-${++idCounter}`;
const nowIso = () => new Date().toISOString();

const resetState = () => {
  state.jobs.clear();
  state.applications.clear();
  state.invitations.clear();
  state.interviews.clear();
  state.organizations.clear();
  state.users.clear();
  state.activityLogs = [];
  idCounter = 0;
};

const isJobCurrentlyPublic = (job) => {
  if (!job || job.deletedAt) return false;
  if (String(job.status || '').toUpperCase() !== 'PUBLISHED') return false;
  if (job.acceptingApplications === false) return false;
  const nowMs = Date.now();
  const publishedAtMs = Date.parse(job.publishedAt || '');
  const expiresAtMs = Date.parse(job.expiresAt || '');
  if (Number.isNaN(publishedAtMs) || publishedAtMs > nowMs) return false;
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= nowMs) return false;
  return true;
};

const activityLogStore = {
  record: jest.fn(async (entry) => {
    state.activityLogs.push({ ...entry, id: nextId('log') });
  }),
};

const jobStore = {
  getById: jest.fn(async (id, options = {}) => {
    const job = state.jobs.get(id);
    if (!job) return null;
    if (job.deletedAt && !options?.includeDeleted) return null;
    return clone(job);
  }),
  delete: jest.fn(async (id, options = {}) => {
    const job = state.jobs.get(id);
    if (!job) return { id, deleted: true, hardDeleted: true };
    const deletedAt = options.deletedAt || nowIso();
    const updated = {
      ...job,
      status: 'ARCHIVED',
      acceptingApplications: false,
      deletedAt,
      deletedBy: options.deletedBy || null,
      deleteReason: options.deleteReason || null,
      deletionMode: 'SOFT',
      updatedAt: deletedAt,
    };
    state.jobs.set(id, updated);
    return clone(updated);
  }),
  listByOrganization: jest.fn(async (organizationId) =>
    [...state.jobs.values()]
      .filter((job) => job.organizationId === organizationId && !job.deletedAt)
      .map((job) => clone(job))),
  countPublishedByOrganization: jest.fn(async (organizationId) =>
    [...state.jobs.values()].filter((job) => (
      job.organizationId === organizationId
      && String(job.status || '').toUpperCase() === 'PUBLISHED'
      && !job.deletedAt
    )).length),
};

const sortByCreatedDesc = (items) =>
  [...items].sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

const jobApplicationStore = {
  create: jest.fn(async (data = {}) => {
    const id = nextId('app');
    const timestamp = nowIso();
    const payload = {
      id,
      status: 'SUBMITTED',
      answers: [],
      statusHistory: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      submittedAt: timestamp,
      ...data,
    };
    state.applications.set(id, payload);
    return clone(payload);
  }),
  getById: jest.fn(async (id) => clone(state.applications.get(id) || null)),
  update: jest.fn(async (id, updates = {}) => {
    const current = state.applications.get(id);
    if (!current) return null;
    const updated = {
      ...current,
      ...updates,
      updatedAt: nowIso(),
    };
    state.applications.set(id, updated);
    return clone(updated);
  }),
  listByJob: jest.fn(async (jobId) =>
    sortByCreatedDesc(
      [...state.applications.values()].filter((app) => app.jobId === jobId),
    ).map((app) => clone(app))),
  listByCandidate: jest.fn(async (candidateId) =>
    sortByCreatedDesc(
      [...state.applications.values()].filter((app) => app.candidateId === candidateId),
    ).map((app) => clone(app))),
  listByCandidatePage: jest.fn(async (candidateId, options = {}) => {
    const limit = Math.max(1, Number.parseInt(options.limit, 10) || 50);
    const items = sortByCreatedDesc(
      [...state.applications.values()].filter((app) => app.candidateId === candidateId),
    );
    return {
      items: items.slice(0, limit).map((app) => clone(app)),
      hasMore: items.length > limit,
      nextCursor: items.length > limit ? items[limit - 1].createdAt : null,
    };
  }),
  listByJobPage: jest.fn(async (jobId, options = {}) => {
    const limit = Math.max(1, Number.parseInt(options.limit, 10) || 50);
    const items = sortByCreatedDesc(
      [...state.applications.values()].filter((app) => app.jobId === jobId),
    );
    return {
      items: items.slice(0, limit).map((app) => clone(app)),
      hasMore: items.length > limit,
      nextCursor: items.length > limit ? items[limit - 1].createdAt : null,
    };
  }),
  listByOrganization: jest.fn(async (organizationId) =>
    sortByCreatedDesc(
      [...state.applications.values()].filter((app) => app.organizationId === organizationId),
    ).map((app) => clone(app))),
  listByOrganizationPage: jest.fn(async (organizationId, options = {}) => {
    const limit = Math.max(1, Number.parseInt(options.limit, 10) || 50);
    const items = sortByCreatedDesc(
      [...state.applications.values()].filter((app) => app.organizationId === organizationId),
    );
    return {
      items: items.slice(0, limit).map((app) => clone(app)),
      hasMore: items.length > limit,
      nextCursor: items.length > limit ? items[limit - 1].createdAt : null,
    };
  }),
  checkDuplicate: jest.fn(async (jobId, candidateId) => {
    const items = sortByCreatedDesc(
      [...state.applications.values()].filter(
        (app) => app.jobId === jobId && app.candidateId === candidateId,
      ),
    );
    return items.length > 0 ? clone(items[0]) : null;
  }),
  countByJob: jest.fn(async (jobId) =>
    [...state.applications.values()].filter((app) => app.jobId === jobId).length),
  countByJobIds: jest.fn(async (jobIds = []) => {
    const result = new Map();
    for (const jobId of jobIds) {
      result.set(jobId, [...state.applications.values()].filter((app) => app.jobId === jobId).length);
    }
    return result;
  }),
};

const organizationStore = {
  getById: jest.fn(async (id) => clone(state.organizations.get(id) || null)),
};

const userStore = {
  getById: jest.fn(async (id) => clone(state.users.get(id) || null)),
  getByUid: jest.fn(async (uid) => clone(state.users.get(uid) || null)),
  getSummary: jest.fn(async (id) => {
    const user = state.users.get(id);
    if (!user) return null;
    return clone({
      id: user.id,
      email: user.email || null,
      fullName: user.fullName || null,
      accountType: user.accountType || null,
      companyName: user.companyName || null,
      profilePhotoUrl: user.profilePhotoUrl || null,
    });
  }),
  getSummaries: jest.fn(async (ids = []) => {
    const map = new Map();
    [...new Set(ids.filter(Boolean))].forEach((id) => {
      const user = state.users.get(id);
      if (!user) return;
      map.set(id, {
        id: user.id,
        email: user.email || null,
        fullName: user.fullName || null,
        accountType: user.accountType || null,
        companyName: user.companyName || null,
        profilePhotoUrl: user.profilePhotoUrl || null,
      });
    });
    return map;
  }),
};

const invitationStore = {
  create: jest.fn(async (data = {}) => {
    const token = data.token || nextId('inv-token');
    const id = data.id || token;
    const payload = {
      id,
      token,
      status: 'PENDING',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...data,
    };
    state.invitations.set(id, payload);
    return clone(payload);
  }),
  getByToken: jest.fn(async (token) => {
    const invitation = [...state.invitations.values()].find((item) => item.token === token);
    return invitation ? clone(invitation) : null;
  }),
  findActiveByJobAndEmail: jest.fn(async (organizationId, jobId, email) => {
    const invitation = [...state.invitations.values()].find((item) => (
      item.organizationId === organizationId
      && item.jobId === jobId
      && String(item.email || '').toLowerCase() === String(email || '').toLowerCase()
      && item.status === 'PENDING'
    ));
    return invitation ? clone(invitation) : null;
  }),
  claimForAcceptance: jest.fn(async (token, userId) => {
    const invitation = [...state.invitations.values()].find((item) => item.token === token);
    if (!invitation) {
      return { status: 'NOT_FOUND', invitation: null };
    }
    if (invitation.status === 'PENDING') {
      if (invitation.acceptanceInProgress) {
        return { status: 'IN_PROGRESS', invitation: clone(invitation) };
      }
      const accepted = {
        ...invitation,
        status: 'ACCEPTED',
        candidateUserId: userId,
        acceptedAt: invitation.acceptedAt || nowIso(),
        acceptanceInProgress: true,
        acceptanceStartedAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.invitations.set(accepted.id, accepted);
      return { status: 'CLAIMED', invitation: clone(accepted) };
    }
    if (invitation.status === 'ACCEPTED' && invitation.acceptedInterviewId) {
      return { status: 'ALREADY_COMPLETED', invitation: clone(invitation) };
    }
    if (invitation.acceptanceInProgress) {
      return { status: 'IN_PROGRESS', invitation: clone(invitation) };
    }
    return { status: 'UNAVAILABLE', invitation: clone(invitation) };
  }),
  finalizeAcceptance: jest.fn(async (invitationId, { interviewId = null, applicationId = null } = {}) => {
    const invitation = state.invitations.get(invitationId);
    if (!invitation) return null;
    const updated = {
      ...invitation,
      status: 'ACCEPTED',
      acceptanceInProgress: false,
      acceptanceStartedAt: null,
      acceptedInterviewId: interviewId || invitation.acceptedInterviewId || null,
      acceptedApplicationId: applicationId || invitation.acceptedApplicationId || null,
      updatedAt: nowIso(),
    };
    state.invitations.set(invitationId, updated);
    return clone(updated);
  }),
  releaseAcceptanceLock: jest.fn(async (invitationId, options = {}) => {
    const invitation = state.invitations.get(invitationId);
    if (!invitation) return null;
    const revertToPending = options?.revertToPending === true;
    const updated = {
      ...invitation,
      ...(revertToPending
        ? {
          status: 'PENDING',
          candidateUserId: null,
          acceptedAt: null,
          acceptedInterviewId: null,
          acceptedApplicationId: null,
        }
        : {}),
      acceptanceInProgress: false,
      acceptanceStartedAt: null,
      updatedAt: nowIso(),
    };
    state.invitations.set(invitationId, updated);
    return clone(updated);
  }),
};

const interviewStore = {
  create: jest.fn(async (data = {}) => {
    const id = nextId('interview');
    const payload = {
      id,
      status: 'SCHEDULED',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...data,
    };
    state.interviews.set(id, payload);
    return clone(payload);
  }),
  getById: jest.fn(async (id) => clone(state.interviews.get(id) || null)),
  listByJob: jest.fn(async (jobId) =>
    sortByCreatedDesc(
      [...state.interviews.values()].filter((interview) => interview.jobId === jobId),
    ).map((interview) => clone(interview))),
  getByInvitationId: jest.fn(async (invitationId) => {
    const interview = [...state.interviews.values()].find((item) => item.invitationId === invitationId);
    return interview ? clone(interview) : null;
  }),
};

const realtimeMocks = {
  publishOrganizationRealtimeUpdate: jest.fn(async () => {}),
  publishCandidateRealtimeUpdate: jest.fn(async () => {}),
  publishPublicRealtimeUpdate: jest.fn(async () => {}),
  publishAdminRealtimeUpdate: jest.fn(async () => {}),
  recordRealtimeEvent: jest.fn(async () => {}),
};

const analyticsStore = {
  getStatsForUser: jest.fn(async () => ({ totalInterviews: 0 })),
  getCompanyMetrics: jest.fn(async () => ({ totalInterviews: 0 })),
  getDashboardMetricsWithComparison: jest.fn(async () => ({ summary: { applications: 1 } })),
  createDailySnapshot: jest.fn(async () => {}),
  getSnapshots: jest.fn(async () => []),
  getCandidateDashboardMetricsWithComparison: jest.fn(async () => ({ summary: { applications: 1 } })),
  createCandidateDailySnapshot: jest.fn(async () => {}),
  getCandidateSnapshots: jest.fn(async () => []),
};

const emailNotifications = {
  sendInvitationReceived: jest.fn(async () => {}),
  sendApplicationReceived: jest.fn(async () => {}),
  sendApplicationStatusUpdated: jest.fn(async () => {}),
  sendOrganizationApproved: jest.fn(async () => {}),
  sendOrganizationRejected: jest.fn(async () => {}),
  sendOrganizationSuspended: jest.fn(async () => {}),
  sendOrganizationReactivated: jest.fn(async () => {}),
};

const queueEmailJob = jest.fn(({ handler, payload }) => {
  if (typeof handler === 'function') {
    const result = handler(payload);
    if (result && typeof result.then === 'function') {
      void result.catch(() => {});
    }
  }
  return nextId('email-job');
});

const queueAnalyticsJob = jest.fn(({ handler, payload }) => {
  if (typeof handler === 'function') {
    const result = handler(payload);
    if (result && typeof result.then === 'function') {
      void result.catch(() => {});
    }
  }
  return nextId('analytics-job');
});

jest.unstable_mockModule('../services/firebaseData.service.js', () => ({
  activityLogStore,
  jobStore,
  organizationStore,
  jobApplicationStore,
  userStore,
  invitationStore,
  interviewStore,
  analyticsStore,
  hydrateInterviewParticipants: jest.fn(async (items = []) => items),
  isJobCurrentlyPublic,
  publishOrganizationRealtimeUpdate: realtimeMocks.publishOrganizationRealtimeUpdate,
  publishCandidateRealtimeUpdate: realtimeMocks.publishCandidateRealtimeUpdate,
  publishPublicRealtimeUpdate: realtimeMocks.publishPublicRealtimeUpdate,
  publishAdminRealtimeUpdate: realtimeMocks.publishAdminRealtimeUpdate,
  recordRealtimeEvent: realtimeMocks.recordRealtimeEvent,
}));

jest.unstable_mockModule('../services/email.service.js', () => ({
  emailNotifications,
}));

jest.unstable_mockModule('../services/backgroundJobQueue.service.js', () => ({
  queueEmailJob,
  queueAnalyticsJob,
  waitForBackgroundJobs: jest.fn(async () => {}),
  backgroundJobQueueStats: jest.fn(() => ({})),
}));

jest.unstable_mockModule('../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { ApplicationController } = await import('../controllers/application.controller.js');
const { JobController } = await import('../controllers/job.controller.js');
const { InvitationController } = await import('../controllers/invitation.controller.js');
const { InterviewController } = await import('../controllers/interview.controller.js');
const { AnalyticsController } = await import('../controllers/analytics.controller.js');

const createResponse = () => {
  const res = {
    statusCode: 200,
    payload: null,
  };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload) => {
    res.payload = payload;
    return res;
  });
  return res;
};

const createCandidateUser = (id, email = 'candidate@example.com') => ({
  id,
  uid: id,
  email,
  accountType: 'CANDIDATE',
  fullName: 'Candidate Tester',
  profile: {
    resumeUrl: '/uploads/resumes/candidate.pdf',
  },
});

const createRecruiterUser = (id, organizationId, email = 'recruiter@example.com') => ({
  id,
  uid: id,
  email,
  accountType: 'COMPANY',
  fullName: 'Recruiter Tester',
  organizationContext: {
    organization: {
      id: organizationId,
    },
    membership: {
      role: 'ADMIN',
    },
  },
});

describe('ATS lifecycle integration', () => {
  beforeEach(() => {
    resetState();
    jest.clearAllMocks();
  });

  it('handles submit -> status transition -> job closure lifecycle with deleted-position visibility', async () => {
    const organizationId = 'org-1';
    const candidateId = 'cand-1';
    const recruiterId = 'rec-1';
    const jobId = 'job-1';
    const now = Date.now();

    state.organizations.set(organizationId, {
      id: organizationId,
      name: 'Acme Labs',
      status: 'APPROVED',
      ownerId: recruiterId,
    });
    state.users.set(candidateId, createCandidateUser(candidateId));
    state.users.set(recruiterId, createRecruiterUser(recruiterId, organizationId));
    state.jobs.set(jobId, {
      id: jobId,
      organizationId,
      title: 'Backend Engineer',
      department: 'Engineering',
      location: 'Remote',
      status: 'PUBLISHED',
      acceptingApplications: true,
      publishedAt: new Date(now - 60_000).toISOString(),
      expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    const submitReq = {
      params: { jobId },
      body: {
        resumeUrl: '/uploads/resumes/candidate.pdf',
        coverLetter: 'I would like to apply.',
      },
      user: createCandidateUser(candidateId),
    };
    const submitRes = createResponse();
    const submitNext = jest.fn();

    await ApplicationController.submitApplication(submitReq, submitRes, submitNext);

    expect(submitNext).not.toHaveBeenCalled();
    expect(submitRes.status).toHaveBeenCalledWith(201);
    expect(submitRes.payload?.success).toBe(true);
    const applicationId = submitRes.payload?.application?.id;
    expect(applicationId).toBeTruthy();
    expect(state.applications.get(applicationId)?.status).toBe('SUBMITTED');

    const updateReq = {
      params: { id: applicationId },
      body: { status: 'SCREENING' },
      user: createRecruiterUser(recruiterId, organizationId),
    };
    const updateRes = createResponse();
    const updateNext = jest.fn();

    await ApplicationController.updateApplicationStatus(updateReq, updateRes, updateNext);

    expect(updateNext).not.toHaveBeenCalled();
    expect(updateRes.payload?.success).toBe(true);
    expect(state.applications.get(applicationId)?.status).toBe('SCREENING');

    const archivedJob = state.jobs.get(jobId);
    state.jobs.set(jobId, {
      ...archivedJob,
      status: 'ARCHIVED',
      acceptingApplications: false,
      updatedAt: nowIso(),
    });

    const deleteReq = {
      params: { id: jobId },
      body: {
        resolveActiveApplications: true,
        notifyCandidates: false,
      },
      user: createRecruiterUser(recruiterId, organizationId),
    };
    const deleteRes = createResponse();
    const deleteNext = jest.fn();

    await JobController.deleteJob(deleteReq, deleteRes, deleteNext);

    expect(deleteNext).not.toHaveBeenCalled();
    expect(deleteRes.payload?.success).toBe(true);
    expect(deleteRes.payload?.resolvedApplicationsCount).toBe(1);
    expect(state.jobs.get(jobId)?.deletedAt).toBeTruthy();

    const listReq = {
      query: {},
      user: createCandidateUser(candidateId),
    };
    const listRes = createResponse();
    const listNext = jest.fn();

    await ApplicationController.getCandidateApplications(listReq, listRes, listNext);

    expect(listNext).not.toHaveBeenCalled();
    expect(listRes.payload?.success).toBe(true);
    expect(Array.isArray(listRes.payload?.applications)).toBe(true);
    expect(listRes.payload.applications).toHaveLength(1);

    const [application] = listRes.payload.applications;
    expect(application.status).toBe('REJECTED');
    expect(application.dispositionCode).toBe('JOB_CLOSED');
    expect(application.job?.title).toBe('Backend Engineer');
    expect(application.job?.isDeleted).toBe(true);
  });

  it('keeps invitation acceptance idempotent and avoids duplicate interview creation', async () => {
    const organizationId = 'org-2';
    const candidateId = 'cand-2';
    const recruiterId = 'rec-2';
    const jobId = 'job-2';
    const invitationId = 'inv-1';
    const invitationToken = 'token-1';
    const now = Date.now();

    state.organizations.set(organizationId, {
      id: organizationId,
      name: 'Vertex Systems',
      status: 'APPROVED',
      ownerId: recruiterId,
    });
    state.users.set(candidateId, createCandidateUser(candidateId, 'candidate2@example.com'));
    state.users.set(recruiterId, createRecruiterUser(recruiterId, organizationId, 'recruiter2@example.com'));
    state.jobs.set(jobId, {
      id: jobId,
      organizationId,
      title: 'Data Engineer',
      department: 'Data',
      status: 'PUBLISHED',
      acceptingApplications: true,
      publishedAt: new Date(now - 60_000).toISOString(),
      expiresAt: new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString(),
      templateConfig: {
        interviewTypes: ['TECHNICAL'],
        duration: 45,
      },
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    state.invitations.set(invitationId, {
      id: invitationId,
      token: invitationToken,
      organizationId,
      jobId,
      email: 'candidate2@example.com',
      invitedBy: recruiterId,
      stage: 'SCREENING',
      status: 'PENDING',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    const acceptReq = {
      body: { token: invitationToken },
      user: createCandidateUser(candidateId, 'candidate2@example.com'),
    };
    const acceptRes1 = createResponse();
    const acceptNext1 = jest.fn();

    await InvitationController.acceptInvitation(acceptReq, acceptRes1, acceptNext1);

    expect(acceptNext1).not.toHaveBeenCalled();
    expect(acceptRes1.payload?.success).toBe(true);
    const firstInterviewId = acceptRes1.payload?.interview?.id;
    expect(firstInterviewId).toBeTruthy();

    const acceptRes2 = createResponse();
    const acceptNext2 = jest.fn();

    await InvitationController.acceptInvitation(acceptReq, acceptRes2, acceptNext2);

    expect(acceptNext2).not.toHaveBeenCalled();
    expect(acceptRes2.payload?.success).toBe(true);
    expect(acceptRes2.payload?.interview?.id).toBe(firstInterviewId);
    expect([...state.interviews.values()]).toHaveLength(1);

    const createdApplications = [...state.applications.values()].filter((app) => (
      app.jobId === jobId && app.candidateId === candidateId
    ));
    expect(createdApplications).toHaveLength(1);
    expect(createdApplications[0].status).toBe('INTERVIEWING');
  });

  it('enforces hiring interview linkage requirements and reuses active interview records', async () => {
    const organizationId = 'org-3';
    const candidateId = 'cand-3';
    const recruiterId = 'rec-3';
    const jobId = 'job-3';
    const now = Date.now();

    state.organizations.set(organizationId, {
      id: organizationId,
      name: 'Northwind ATS',
      status: 'APPROVED',
      ownerId: recruiterId,
    });
    state.users.set(candidateId, createCandidateUser(candidateId, 'candidate3@example.com'));
    state.users.set(recruiterId, createRecruiterUser(recruiterId, organizationId, 'recruiter3@example.com'));
    state.jobs.set(jobId, {
      id: jobId,
      organizationId,
      title: 'Platform Engineer',
      department: 'Platform',
      status: 'PUBLISHED',
      acceptingApplications: true,
      publishedAt: new Date(now - 60_000).toISOString(),
      expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await jobApplicationStore.create({
      jobId,
      candidateId,
      organizationId,
      status: 'SCREENING',
      resumeUrl: '/uploads/resumes/candidate3.pdf',
    });

    const missingCandidateReq = {
      body: {
        mode: 'HIRING',
        jobId,
        jobRole: 'Platform Engineer',
      },
      user: createRecruiterUser(recruiterId, organizationId),
    };
    const missingCandidateRes = createResponse();
    const missingCandidateNext = jest.fn();

    await InterviewController.createInterview(missingCandidateReq, missingCandidateRes, missingCandidateNext);

    expect(missingCandidateNext).not.toHaveBeenCalled();
    expect(missingCandidateRes.status).toHaveBeenCalledWith(400);
    expect(missingCandidateRes.payload?.code).toBe('HIRING_CANDIDATE_REQUIRED');

    const createReq = {
      body: {
        mode: 'HIRING',
        jobId,
        candidateId,
        jobRole: 'Platform Engineer',
        interviewTypes: ['TECHNICAL'],
        duration: 45,
      },
      user: createRecruiterUser(recruiterId, organizationId),
    };
    const createRes1 = createResponse();
    const createNext1 = jest.fn();

    await InterviewController.createInterview(createReq, createRes1, createNext1);

    expect(createNext1).not.toHaveBeenCalled();
    expect(createRes1.statusCode).toBe(201);
    expect(createRes1.payload?.success).toBe(true);
    const firstInterviewId = createRes1.payload?.interview?.id;
    expect(firstInterviewId).toBeTruthy();
    expect(createRes1.payload?.interview?.candidateId).toBe(candidateId);
    expect([...state.interviews.values()]).toHaveLength(1);

    const createRes2 = createResponse();
    const createNext2 = jest.fn();

    await InterviewController.createInterview(createReq, createRes2, createNext2);

    expect(createNext2).not.toHaveBeenCalled();
    expect(createRes2.statusCode).toBe(200);
    expect(createRes2.payload?.success).toBe(true);
    expect(createRes2.payload?.reusedExistingInterview).toBe(true);
    expect(createRes2.payload?.interview?.id).toBe(firstInterviewId);
    expect([...state.interviews.values()]).toHaveLength(1);
  });

  it('queues heavy analytics snapshot work while returning dashboard metrics', async () => {
    const req = {
      user: {
        id: 'rec-analytics',
        accountType: 'COMPANY',
        profile: {
          primaryOrganizationId: 'org-analytics',
        },
      },
      query: {},
    };
    const res = createResponse();
    const next = jest.fn();

    await AnalyticsController.getDashboardMetrics(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.payload?.success).toBe(true);
    expect(queueAnalyticsJob).toHaveBeenCalled();
    expect(analyticsStore.getDashboardMetricsWithComparison).toHaveBeenCalledWith('org-analytics');
    expect(analyticsStore.createDailySnapshot).toHaveBeenCalledWith('org-analytics');
  });
});
