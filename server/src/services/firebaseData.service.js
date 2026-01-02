import { randomUUID } from 'crypto';
import { firestore, realtimeDb } from '../config/firebase.js';
import logger from '../utils/logger.js';

const usersCollection = firestore.collection('users');
const interviewsCollection = firestore.collection('interviews');
const webrtcCollection = firestore.collection('webrtcSessions');
const organizationsCollection = firestore.collection('organizations');
const organizationMembersCollection = firestore.collection('organizationMembers');
const jobsCollection = firestore.collection('jobs');
const invitationsCollection = firestore.collection('invitations');
const interviewReviewsCollection = firestore.collection('interviewReviews');
const activityLogsCollection = firestore.collection('activityLogs');
const jobApplicationsCollection = firestore.collection('jobApplications');
const platformAuditLogsCollection = firestore.collection('platformAuditLogs');
const systemSettingsCollection = firestore.collection('systemSettings');

const QUESTION_TYPES = new Set(['BEHAVIORAL', 'TECHNICAL', 'CODING', 'SYSTEM_DESIGN']);
const DIFFICULTY_LEVELS = new Set(['EASY', 'MEDIUM', 'HARD']);
const ORG_ROLES = new Set(['ADMIN', 'RECRUITER', 'REVIEWER']);
const JOB_STATUSES = new Set(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const INVITATION_STATUSES = new Set(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']);
const PIPELINE_STATUSES = new Set(['SCREENING', 'INTERVIEW', 'FINAL', 'HIRED', 'REJECTED']);
const ACTIVITY_ACTIONS = new Set(['JOB_CREATED', 'JOB_UPDATED', 'INVITATION_SENT', 'PIPELINE_MOVED', 'REVIEW_SUBMITTED', 'MEMBER_UPDATED']);

const now = () => new Date().toISOString();

const docToData = (doc) => {
  if (!doc || !doc.exists) {
    return null;
  }
  return { id: doc.id, ...doc.data() };
};

const isIndexBuildingError = (error) => {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  const code = typeof error.code === 'string' ? error.code.toLowerCase() : error.code;
  const isPrecondition = code === 9 || code === 'failed-precondition';
  return isPrecondition && message.includes('requires an index');
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  return 0;
};

const buildUserSummary = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || null,
    fullName: user.fullName || null,
    accountType: user.accountType || null,
    companyName: user.companyName || null,
    profilePhotoUrl: user.profilePhotoUrl || user.photoURL || null,
  };
};

const normalizeQuestionType = (type) => {
  if (!type) return 'BEHAVIORAL';
  const upper = type.toString().toUpperCase();
  if (QUESTION_TYPES.has(upper)) return upper;
  switch (upper) {
    case 'SYSTEM DESIGN':
    case 'SYSTEM-DESIGN':
    case 'SYSTEM_DESIGN':
      return 'SYSTEM_DESIGN';
    default:
      return 'BEHAVIORAL';
  }
};

const normalizeDifficulty = (difficulty) => {
  if (!difficulty) return 'MEDIUM';
  const upper = difficulty.toString().toUpperCase();
  if (DIFFICULTY_LEVELS.has(upper)) return upper;
  return 'MEDIUM';
};

const ensureArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

const sanitizeOrgRole = (role) => {
  if (!role) return null;
  const normalized = role.toString().toUpperCase();
  if (ORG_ROLES.has(normalized)) return normalized;
  return 'RECRUITER';
};

const organizationDocToData = (doc) => {
  if (!doc || !doc.exists) return null;
  return { id: doc.id, ...doc.data() };
};

export const userStore = {
  async getByUid(uid) {
    const doc = await usersCollection.doc(uid).get();
    return docToData(doc);
  },

  async getByEmail(email) {
    if (!email) return null;
    const snapshot = await usersCollection.where('email', '==', email.toLowerCase()).limit(1).get();
    if (snapshot.empty) return null;
    return docToData(snapshot.docs[0]);
  },

  async findByResumeHash(resumeHash) {
    if (!resumeHash) return [];
    const snapshot = await usersCollection.where('resumeHash', '==', resumeHash).get();
    return snapshot.docs.map((doc) => docToData(doc));
  },

  async create(uid, data = {}) {
    const payload = {
      id: uid,
      email: (data.email || '').toLowerCase(),
      accountType: data.accountType,
      fullName: data.fullName || null,
      experienceLevel: data.experienceLevel || null,
      skills: data.skills || [],
      companyName: data.companyName || null,
      companySize: data.companySize || null,
      industry: data.industry || null,
      profilePhotoUrl: data.profilePhotoUrl || null,
      resumeUrl: data.resumeUrl || null,
      resumeOriginalName: data.resumeOriginalName || null,
      resumeHash: data.resumeHash || null,
      companyLogoUrl: data.companyLogoUrl || null,
      companyVerificationUrl: data.companyVerificationUrl || null,
      companyVerificationOriginalName: data.companyVerificationOriginalName || null,
      primaryOrganizationId: data.primaryOrganizationId || null,
      organizationRoles: ensureArray(data.organizationRoles),
      authProvider: 'firebase',
      createdAt: now(),
      updatedAt: now(),
    };
    await usersCollection.doc(uid).set(payload);
    return payload;
  },

  async update(uid, data = {}) {
    const updatePayload = {
      ...data,
      updatedAt: now(),
    };
    await usersCollection.doc(uid).set(updatePayload, { merge: true });
    const doc = await usersCollection.doc(uid).get();
    return docToData(doc);
  },

  async getSummary(uid) {
    const user = await this.getByUid(uid);
    return buildUserSummary(user);
  },

  async getSummaries(uids = []) {
    const uniqueIds = Array.from(new Set(uids.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return new Map();
    }

    const docs = await Promise.all(uniqueIds.map((id) => usersCollection.doc(id).get()));
    const map = new Map();
    docs.forEach((doc) => {
      if (doc.exists) {
        map.set(doc.id, buildUserSummary(docToData(doc)));
      }
    });
    return map;
  },
};

const mapQuestionsSnapshot = (snapshot) => snapshot.docs.map((doc) => docToData(doc));

export const interviewStore = {
  async create(data = {}) {
    const docRef = interviewsCollection.doc();
    const payload = {
      id: docRef.id,
      mode: data.mode,
      candidateId: data.candidateId || null,
      companyId: data.companyId || null,
      organizationId: data.organizationId || null,
      jobId: data.jobId || null,
      jobStage: data.jobStage || null,
      invitationId: data.invitationId || null,
      pipelineStatus: PIPELINE_STATUSES.has((data.pipelineStatus || '').toUpperCase())
        ? data.pipelineStatus.toUpperCase()
        : null,
      reviewerAssignments: ensureArray(data.reviewerAssignments),
      status: data.status || 'SCHEDULED',
      jobRole: data.jobRole || null,
      experienceLevel: data.experienceLevel || null,
      industry: data.industry || null,
      interviewTypes: ensureArray(data.interviewTypes),
      skillFocus: ensureArray(data.skillFocus),
      duration: data.duration || 30,
      startedAt: data.startedAt || null,
      endedAt: data.endedAt || null,
      transcript: data.transcript || null,
      evaluation: data.evaluation || null,
      overallScore: data.overallScore || null,
      readinessLevel: data.readinessLevel || null,
      createdAt: now(),
      updatedAt: now(),
    };

    await docRef.set(payload);
    return payload;
  },

  async getById(id) {
    const doc = await interviewsCollection.doc(id).get();
    return docToData(doc);
  },

  async getWithQuestions(id) {
    const interview = await this.getById(id);
    if (!interview) return null;

    const questionsSnapshot = await interviewsCollection
      .doc(id)
      .collection('questions')
      .orderBy('sequence', 'asc')
      .get();

    return {
      ...interview,
      questions: mapQuestionsSnapshot(questionsSnapshot),
    };
  },

  async update(id, data = {}) {
    const docRef = interviewsCollection.doc(id);
    await docRef.set(
      {
        ...data,
        updatedAt: now(),
      },
      { merge: true },
    );
    const updated = await docRef.get();
    return docToData(updated);
  },

  async addQuestions(interviewId, questions = []) {
    if (!questions.length) return [];
    const batch = firestore.batch();
    const questionsCollection = interviewsCollection.doc(interviewId).collection('questions');

    questions.forEach((q, index) => {
      const questionId = q.id || randomUUID();
      const docRef = questionsCollection.doc(questionId);
      batch.set(docRef, {
        id: questionId,
        interviewId,
        sequence: q.sequence || index + 1,
        question: q.question,
        questionType: normalizeQuestionType(q.questionType || q.type),
        difficulty: normalizeDifficulty(q.difficulty),
        expectedDuration: parseInt(q.expectedDuration, 10) || 3,
        evaluationCriteria: ensureArray(q.evaluationCriteria),
        answer: q.answer || null,
        answerAudioUrl: q.answerAudioUrl || null,
        askedAt: q.askedAt || null,
        answeredAt: q.answeredAt || null,
        timeToAnswer: q.timeToAnswer || null,
        score: q.score || null,
        strengths: ensureArray(q.strengths).filter(Boolean),
        weaknesses: ensureArray(q.weaknesses).filter(Boolean),
        feedback: q.feedback || null,
        followUpQuestion: q.followUpQuestion || null,
        createdAt: now(),
        updatedAt: now(),
      });
    });

    await batch.commit();
    const questionsSnapshot = await questionsCollection.orderBy('sequence', 'asc').get();
    return mapQuestionsSnapshot(questionsSnapshot);
  },

  async listByCandidate(candidateId) {
    if (!candidateId) return [];
    const snapshot = await interviewsCollection.where('candidateId', '==', candidateId).get();
    return snapshot.docs.map((doc) => docToData(doc));
  },

  async listByCompany(companyId) {
    if (!companyId) return [];
    const snapshot = await interviewsCollection.where('companyId', '==', companyId).get();
    return snapshot.docs.map((doc) => docToData(doc));
  },

  async listByOrganization(organizationId) {
    if (!organizationId) return [];
    const snapshot = await interviewsCollection.where('organizationId', '==', organizationId).get();
    return snapshot.docs.map((doc) => docToData(doc));
  },

  async listByJob(jobId) {
    if (!jobId) return [];
    const snapshot = await interviewsCollection.where('jobId', '==', jobId).get();
    return snapshot.docs.map((doc) => docToData(doc));
  },

  async getQuestion(interviewId, questionId) {
    const doc = await interviewsCollection.doc(interviewId).collection('questions').doc(questionId).get();
    return docToData(doc);
  },

  async updateQuestion(interviewId, questionId, data = {}) {
    const docRef = interviewsCollection.doc(interviewId).collection('questions').doc(questionId);
    await docRef.set(
      {
        ...data,
        updatedAt: now(),
      },
      { merge: true },
    );
    const updated = await docRef.get();
    return docToData(updated);
  },

  async getQuestions(interviewId) {
    const snapshot = await interviewsCollection
      .doc(interviewId)
      .collection('questions')
      .orderBy('sequence', 'asc')
      .get();
    return mapQuestionsSnapshot(snapshot);
  },
};

export const webrtcStore = {
  async getSession(interviewId) {
    if (!interviewId) return null;
    const doc = await webrtcCollection.doc(interviewId).get();
    return docToData(doc);
  },

  async upsertSession(interviewId, data = {}) {
    if (!interviewId) {
      throw new Error('interviewId is required for WebRTC sessions');
    }

    const docRef = webrtcCollection.doc(interviewId);
    const existing = await docRef.get();
    const payload = {
      interviewId,
      roomId: data.roomId,
      peerId: data.peerId,
      isConnected: data.isConnected ?? existing.data()?.isConnected ?? false,
      createdAt: existing.exists ? existing.data().createdAt : now(),
      updatedAt: now(),
    };

    await docRef.set(payload, { merge: true });
    return docToData(await docRef.get());
  },
};

export async function savePoseData(interviewId, posePayload = {}) {
  if (!interviewId) {
    throw new Error('interviewId is required for pose data');
  }

  await interviewsCollection.doc(interviewId).collection('poseData').add({
    interviewId,
    poseLandmarks: posePayload.poseLandmarks || posePayload.landmarks || null,
    gestureData: posePayload.gestureData || posePayload.gestures || null,
    confidence: posePayload.confidence || null,
    engagementScore: posePayload.engagementScore || null,
    postureQuality: posePayload.postureQuality || null,
    createdAt: now(),
  });
}

export async function recordRealtimeEvent(interviewId, eventType, payload = {}) {
  if (!realtimeDb || !interviewId) return;

  const event = {
    eventType,
    payload,
    timestamp: now(),
  };

  try {
    const eventsRef = realtimeDb.ref(`sessions/${interviewId}/events`).push();
    await eventsRef.set(event);
    await realtimeDb.ref(`sessions/${interviewId}/lastEvent`).set(event);
  } catch (error) {
    logger.error('Failed to record realtime event:', error);
  }
}

export async function hydrateInterviewParticipants(interviews = []) {
  if (!interviews.length) return interviews;

  const participantIds = new Set();
  interviews.forEach((interview) => {
    if (interview?.candidateId) participantIds.add(interview.candidateId);
    if (interview?.companyId) participantIds.add(interview.companyId);
  });

  const summaries = await userStore.getSummaries(Array.from(participantIds));

  return interviews.map((interview) => ({
    ...interview,
    candidate: interview.candidateId ? summaries.get(interview.candidateId) || null : null,
    company: interview.companyId ? summaries.get(interview.companyId) || null : null,
  }));
}

export const analyticsStore = {
  async getStatsForUser(userId, accountType) {
    let interviews = [];
    if (accountType === 'CANDIDATE') {
      interviews = await interviewStore.listByCandidate(userId);
    } else {
      interviews = await interviewStore.listByCompany(userId);
    }

    const completed = interviews.filter((i) => i.status === 'COMPLETED');

    return {
      totalInterviews: interviews.length,
      completedInterviews: completed.length,
      inProgressInterviews: interviews.filter((i) => i.status === 'IN_PROGRESS').length,
    };
  },

  async getCompanyMetrics(companyId) {
    const interviews = await interviewStore.listByCompany(companyId);
    const completed = interviews.filter((i) => i.status === 'COMPLETED');
    const averageScore =
      completed.length > 0
        ? completed.reduce((sum, interview) => sum + (interview.overallScore || 0), 0) / completed.length
        : 0;

    return {
      totalInterviews: interviews.length,
      completedInterviews: completed.length,
      averageScore: Math.round(averageScore * 100) / 100,
      inProgressInterviews: interviews.filter((i) => i.status === 'IN_PROGRESS').length,
    };
  },
};

export const organizationStore = {
  async create(data = {}) {
    const docRef = organizationsCollection.doc();
    const payload = {
      id: docRef.id,
      name: data.name || data.displayName || 'New Organization',
      displayName: data.displayName || data.name || 'New Organization',
      ownerId: data.ownerId || null,
      industry: data.industry || null,
      companySize: data.companySize || null,
      logo: data.logo || null,
      website: data.website || null,
      status: data.status || 'PENDING', // Default to PENDING - requires admin approval
      branding: data.branding || { theme: 'default' },
      settings: data.settings || {
        retentionPolicyDays: 365,
        defaultRole: 'RECRUITER',
      },
      createdAt: now(),
      updatedAt: now(),
    };

    await docRef.set(payload);
    return payload;
  },

  async getById(id) {
    if (!id) return null;
    const doc = await organizationsCollection.doc(id).get();
    return organizationDocToData(doc);
  },

  async update(id, data = {}) {
    if (!id) throw new Error('Organization ID is required');
    const docRef = organizationsCollection.doc(id);
    await docRef.set(
      {
        ...data,
        updatedAt: now(),
      },
      { merge: true },
    );
    const updated = await docRef.get();
    return organizationDocToData(updated);
  },

  async updateLogo(id, logoUrl) {
    if (!id) throw new Error('Organization ID is required');
    const docRef = organizationsCollection.doc(id);
    await docRef.set({ logo: logoUrl, updatedAt: now() }, { merge: true });
    const updated = await docRef.get();
    return organizationDocToData(updated);
  },

  async listAll(limit = 100, offset = 0) {
    try {
      const snapshot = await organizationsCollection
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset)
        .get();
      return snapshot.docs.map((doc) => organizationDocToData(doc));
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('Organization index still building; falling back to in-memory sort.');
      const snapshot = await organizationsCollection.get();
      return snapshot.docs
        .map((doc) => organizationDocToData(doc))
        .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt))
        .slice(offset, offset + limit);
    }
  },

  async listByStatus(status, limit = 100) {
    if (!status) return [];
    try {
      const snapshot = await organizationsCollection
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      return snapshot.docs.map((doc) => organizationDocToData(doc));
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('Organization status index still building; falling back to in-memory filter.');
      const snapshot = await organizationsCollection.get();
      return snapshot.docs
        .map((doc) => organizationDocToData(doc))
        .filter((org) => org.status === status)
        .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt))
        .slice(0, limit);
    }
  },

  async approve(id, approvedBy) {
    if (!id) throw new Error('Organization ID is required');
    const docRef = organizationsCollection.doc(id);
    await docRef.set(
      {
        status: 'APPROVED',
        approvedBy: approvedBy || null,
        approvedAt: now(),
        updatedAt: now(),
      },
      { merge: true },
    );
    const updated = await docRef.get();
    return organizationDocToData(updated);
  },

  async reject(id, reason, rejectedBy) {
    if (!id) throw new Error('Organization ID is required');
    if (!reason || !reason.trim()) {
      throw new Error('Rejection reason is required');
    }
    const docRef = organizationsCollection.doc(id);
    await docRef.set(
      {
        status: 'REJECTED',
        rejectedReason: reason.trim(),
        rejectedBy: rejectedBy || null,
        rejectedAt: now(),
        updatedAt: now(),
      },
      { merge: true },
    );
    const updated = await docRef.get();
    return organizationDocToData(updated);
  },

  async suspend(id, reason, suspendedBy) {
    if (!id) throw new Error('Organization ID is required');
    if (!reason || !reason.trim()) {
      throw new Error('Suspension reason is required');
    }
    const docRef = organizationsCollection.doc(id);
    await docRef.set(
      {
        status: 'SUSPENDED',
        suspensionReason: reason.trim(),
        suspendedBy: suspendedBy || null,
        suspendedAt: now(),
        updatedAt: now(),
      },
      { merge: true },
    );
    const updated = await docRef.get();
    return organizationDocToData(updated);
  },

  async activate(id) {
    if (!id) throw new Error('Organization ID is required');
    const docRef = organizationsCollection.doc(id);
    await docRef.set(
      {
        status: 'APPROVED',
        suspendedAt: null,
        suspensionReason: null,
        suspendedBy: null,
        updatedAt: now(),
      },
      { merge: true },
    );
    const updated = await docRef.get();
    return organizationDocToData(updated);
  },
};

export const organizationMemberStore = {
  async addMember({ organizationId, userId, role = 'RECRUITER', status = 'ACTIVE', permissions = [] }) {
    if (!organizationId || !userId) {
      throw new Error('organizationId and userId are required');
    }

    const normalizedRole = sanitizeOrgRole(role) || 'RECRUITER';
    const membershipId = `${organizationId}_${userId}`;
    const docRef = organizationMembersCollection.doc(membershipId);
    const payload = {
      id: membershipId,
      organizationId,
      userId,
      role: normalizedRole,
      status,
      permissions: ensureArray(permissions),
      createdAt: now(),
      updatedAt: now(),
    };

    await docRef.set(payload, { merge: true });
    const updated = await docRef.get();
    return organizationDocToData(updated);
  },

  async getMember(organizationId, userId) {
    if (!organizationId || !userId) return null;
    const membershipId = `${organizationId}_${userId}`;
    const doc = await organizationMembersCollection.doc(membershipId).get();
    return organizationDocToData(doc);
  },

  async listByUser(userId) {
    if (!userId) return [];
    const snapshot = await organizationMembersCollection.where('userId', '==', userId).get();
    return snapshot.docs.map((doc) => organizationDocToData(doc));
  },

  async listByOrganization(organizationId) {
    if (!organizationId) return [];
    const snapshot = await organizationMembersCollection.where('organizationId', '==', organizationId).get();
    return snapshot.docs.map((doc) => organizationDocToData(doc));
  },
};

const sanitizeJobStatus = (status) => {
  if (!status) return 'DRAFT';
  const normalized = status.toString().toUpperCase();
  if (JOB_STATUSES.has(normalized)) return normalized;
  return 'DRAFT';
};

export const jobStore = {
  async create(data = {}) {
    const docRef = jobsCollection.doc();
    const payload = {
      id: docRef.id,
      organizationId: data.organizationId,
      createdBy: data.createdBy || null,
      title: data.title,
      department: data.department || null,
      location: data.location || 'Remote',
      employmentType: data.employmentType || 'FULL_TIME',
      experienceLevel: data.experienceLevel || 'MID',
      compensationRange: data.compensationRange || null,
      description: data.description || '',
      requirements: ensureArray(data.requirements),
      responsibilities: ensureArray(data.responsibilities),
      skills: ensureArray(data.skills),
      status: sanitizeJobStatus(data.status),
      stages: ensureArray(data.stages),
      templateConfig: data.templateConfig || {
        interviewTypes: ['BEHAVIORAL'],
        duration: 30,
        scoringRubric: [],
      },
      reviewerIds: ensureArray(data.reviewerIds),
      hiringManagerId: data.hiringManagerId || null,
      publishedAt: data.status === 'PUBLISHED' ? data.publishedAt || now() : null,
      createdAt: now(),
      updatedAt: now(),
    };

    await docRef.set(payload);
    return payload;
  },

  async update(id, data = {}) {
    const docRef = jobsCollection.doc(id);
    const payload = {
      ...data,
      ...(data.status ? { status: sanitizeJobStatus(data.status) } : {}),
      ...(data.status === 'PUBLISHED' ? { publishedAt: data.publishedAt || now() } : {}),
      updatedAt: now(),
    };
    await docRef.set(payload, { merge: true });
    const updated = await docRef.get();
    return docToData(updated);
  },

  async getById(id) {
    if (!id) return null;
    const doc = await jobsCollection.doc(id).get();
    return docToData(doc);
  },

  async listByOrganization(organizationId) {
    if (!organizationId) return [];
    const snapshot = await jobsCollection.where('organizationId', '==', organizationId).orderBy('createdAt', 'desc').get();
    return snapshot.docs.map((doc) => docToData(doc));
  },

  async listPublished(limit = 20) {
    const snapshot = await jobsCollection.where('status', '==', 'PUBLISHED').orderBy('publishedAt', 'desc').limit(limit).get();
    return snapshot.docs.map((doc) => docToData(doc));
  },

  async delete(id) {
    if (!id) throw new Error('Job ID is required');
    const docRef = jobsCollection.doc(id);
    await docRef.delete();
    return { id, deleted: true };
  },
};

const buildInvitationPayload = (data = {}) => {
  const token = data.token || randomUUID();
  return {
    id: data.id || token,
    token,
    organizationId: data.organizationId,
    jobId: data.jobId,
    stage: data.stage || 'SCREENING',
    email: (data.email || '').toLowerCase(),
    invitedBy: data.invitedBy || null,
    candidateUserId: data.candidateUserId || null,
    status: INVITATION_STATUSES.has((data.status || '').toUpperCase()) ? data.status.toUpperCase() : 'PENDING',
    expiresAt: data.expiresAt || null,
    metadata: data.metadata || {},
    acceptedAt: data.acceptedAt || null,
    createdAt: now(),
    updatedAt: now(),
  };
};

export const invitationStore = {
  async create(data = {}) {
    const payload = buildInvitationPayload(data);
    await invitationsCollection.doc(payload.id).set(payload);
    return payload;
  },

  async getById(id) {
    if (!id) return null;
    const doc = await invitationsCollection.doc(id).get();
    return docToData(doc);
  },

  async getByToken(token) {
    if (!token) return null;
    const snapshot = await invitationsCollection.where('token', '==', token).limit(1).get();
    if (snapshot.empty) return null;
    return docToData(snapshot.docs[0]);
  },

  async listByOrganization(organizationId) {
    if (!organizationId) return [];
    try {
      const snapshot = await invitationsCollection.where('organizationId', '==', organizationId).orderBy('createdAt', 'desc').get();
      return snapshot.docs.map((doc) => docToData(doc));
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('Invitation index still building; falling back to in-memory sort.');
      const snapshot = await invitationsCollection.where('organizationId', '==', organizationId).get();
      return snapshot.docs
        .map((doc) => docToData(doc))
        .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));
    }
  },

  async markAccepted(token, userId) {
    const invitation = await this.getByToken(token);
    if (!invitation) return null;
    await invitationsCollection.doc(invitation.id).set(
      {
        status: 'ACCEPTED',
        candidateUserId: userId,
        acceptedAt: now(),
        updatedAt: now(),
      },
      { merge: true },
    );
    const updated = await invitationsCollection.doc(invitation.id).get();
    return docToData(updated);
  },
};

export const reviewStore = {
  async submit(interviewId, data = {}) {
    if (!interviewId) {
      throw new Error('interviewId is required');
    }
    const docRef = interviewReviewsCollection.doc();
    const payload = {
      id: docRef.id,
      interviewId,
      reviewerId: data.reviewerId,
      reviewerRole: data.reviewerRole || null,
      score: data.score || null,
      decision: data.decision || null,
      strengths: ensureArray(data.strengths),
      weaknesses: ensureArray(data.weaknesses),
      notes: data.notes || '',
      createdAt: now(),
      updatedAt: now(),
    };
    await docRef.set(payload);
    return payload;
  },

  async listByInterview(interviewId) {
    if (!interviewId) return [];
    const snapshot = await interviewReviewsCollection
      .where('interviewId', '==', interviewId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map((doc) => docToData(doc));
  },
};

const sanitizeActivityAction = (action) => {
  if (!action) return 'UNKNOWN';
  const normalized = action.toString().toUpperCase();
  if (ACTIVITY_ACTIONS.has(normalized)) return normalized;
  return normalized || 'UNKNOWN';
};

export const activityLogStore = {
  async record({
    organizationId,
    actorId,
    actorRole,
    action,
    targetType,
    targetId,
    metadata = {},
  }) {
    if (!organizationId) {
      throw new Error('organizationId is required for activity logs');
    }

    const docRef = activityLogsCollection.doc();
    const payload = {
      id: docRef.id,
      organizationId,
      actorId: actorId || null,
      actorRole: actorRole || null,
      action: sanitizeActivityAction(action),
      targetType: targetType || null,
      targetId: targetId || null,
      metadata,
      createdAt: now(),
    };
    await docRef.set(payload);
    return payload;
  },

  async listByOrganization(organizationId, limit = 50) {
    if (!organizationId) return [];
    const snapshot = await activityLogsCollection
      .where('organizationId', '==', organizationId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => docToData(doc));
  },
};

export const jobApplicationStore = {
  async create(data = {}) {
    const docRef = jobApplicationsCollection.doc();
    const currentTime = now();
    const payload = {
      id: docRef.id,
      jobId: data.jobId,
      candidateId: data.candidateId,
      organizationId: data.organizationId,
      status: data.status || 'SUBMITTED',
      resumeUrl: data.resumeUrl || null,
      coverLetter: data.coverLetter || null,
      answers: ensureArray(data.answers),
      submittedAt: data.submittedAt || currentTime,
      createdAt: currentTime,
      updatedAt: currentTime,
    };
    await docRef.set(payload);
    return payload;
  },

  async getById(id) {
    if (!id) return null;
    const doc = await jobApplicationsCollection.doc(id).get();
    return docToData(doc);
  },

  async checkDuplicate(jobId, candidateId) {
    if (!jobId || !candidateId) return null;
    const snapshot = await jobApplicationsCollection
      .where('jobId', '==', jobId)
      .where('candidateId', '==', candidateId)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    return docToData(snapshot.docs[0]);
  },

  async listByCandidate(candidateId) {
    if (!candidateId) return [];
    try {
      const snapshot = await jobApplicationsCollection
        .where('candidateId', '==', candidateId)
        .orderBy('createdAt', 'desc')
        .get();
      return snapshot.docs.map((doc) => docToData(doc));
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('Job application index missing or still building; falling back to in-memory sort. Please create the required Firestore composite index.');
      const snapshot = await jobApplicationsCollection.where('candidateId', '==', candidateId).get();
      return snapshot.docs
        .map((doc) => docToData(doc))
        .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));
    }
  },

  async listByJob(jobId) {
    if (!jobId) return [];
    try {
      const snapshot = await jobApplicationsCollection
        .where('jobId', '==', jobId)
        .orderBy('createdAt', 'desc')
        .get();
      return snapshot.docs.map((doc) => docToData(doc));
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('Job application index missing or still building; falling back to in-memory sort. Please create the required Firestore composite index.');
      const snapshot = await jobApplicationsCollection.where('jobId', '==', jobId).get();
      return snapshot.docs
        .map((doc) => docToData(doc))
        .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));
    }
  },

  async listByOrganization(organizationId, limit = 50) {
    if (!organizationId) return [];
    try {
      const snapshot = await jobApplicationsCollection
        .where('organizationId', '==', organizationId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      return snapshot.docs.map((doc) => docToData(doc));
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('Job application index missing or still building; falling back to in-memory sort. Please create the required Firestore composite index.');
      const snapshot = await jobApplicationsCollection
        .where('organizationId', '==', organizationId)
        .get();
      return snapshot.docs
        .map((doc) => docToData(doc))
        .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt))
        .slice(0, limit);
    }
  },

  async update(id, updates) {
    if (!id) throw new Error('Application ID is required');
    const updateData = {
      ...updates,
      updatedAt: now(),
    };
    await jobApplicationsCollection.doc(id).set(updateData, { merge: true });
    const updated = await jobApplicationsCollection.doc(id).get();
    return docToData(updated);
  },
};

export const platformAuditLogStore = {
  async record({ actorId, actorType, action, targetType, targetId, metadata = {} }) {
    const docRef = platformAuditLogsCollection.doc();
    const payload = {
      id: docRef.id,
      actorId: actorId || null,
      actorType: actorType || null,
      action: action || 'UNKNOWN',
      targetType: targetType || null,
      targetId: targetId || null,
      metadata,
      createdAt: now(),
    };
    await docRef.set(payload);
    return payload;
  },

  async list(limit = 100, offset = 0) {
    try {
      const snapshot = await platformAuditLogsCollection
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset)
        .get();
      return snapshot.docs.map((doc) => docToData(doc));
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('Platform audit log index still building; falling back to in-memory sort.');
      const snapshot = await platformAuditLogsCollection.get();
      return snapshot.docs
        .map((doc) => docToData(doc))
        .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt))
        .slice(offset, offset + limit);
    }
  },
};

export const systemSettingsStore = {
  async initialize(adminId) {
    const settingsDoc = await systemSettingsCollection.doc('main').get();
    if (settingsDoc.exists) {
      return docToData(settingsDoc);
    }

    const defaultSettings = {
      id: 'main',
      featureFlags: {
        enableJobPosting: true,
        enableInvitations: true,
        enableReviews: true,
        enableAnalytics: true,
      },
      maintenanceMode: false,
      defaultAIConfig: {
        model: 'llama3.2',
        temperature: 0.7,
        maxTokens: 2000,
      },
      dataRetention: {
        interviewDataDays: 365,
        activityLogDays: 90,
      },
      createdAt: now(),
      updatedAt: now(),
      initializedBy: adminId,
    };

    await systemSettingsCollection.doc('main').set(defaultSettings);
    return defaultSettings;
  },

  async get() {
    const doc = await systemSettingsCollection.doc('main').get();
    if (!doc.exists) {
      // Return defaults if not initialized
      return {
        id: 'main',
        featureFlags: {
          enableJobPosting: true,
          enableInvitations: true,
          enableReviews: true,
          enableAnalytics: true,
        },
        maintenanceMode: false,
        defaultAIConfig: {
          model: 'llama3.2',
          temperature: 0.7,
          maxTokens: 2000,
        },
        dataRetention: {
          interviewDataDays: 365,
          activityLogDays: 90,
        },
      };
    }
    return docToData(doc);
  },

  async update(updates, updatedBy) {
    const current = await this.get();
    const merged = {
      ...current,
      ...updates,
      updatedAt: now(),
      updatedBy: updatedBy || current.updatedBy,
    };
    await systemSettingsCollection.doc('main').set(merged, { merge: true });
    return merged;
  },
};

