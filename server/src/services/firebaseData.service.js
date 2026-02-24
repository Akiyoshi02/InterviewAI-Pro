import { randomUUID } from 'crypto';
import { firestore, realtimeDb } from '../config/firebase.js';
import logger from '../utils/logger.js';
import {
  decodeAuditCursor,
  normalizeAuditPageLimit,
  sliceAuditLogsPage,
  sortAuditLogsByCreatedAtDesc,
} from '../utils/auditLogPagination.util.js';
import {
  evaluateInvitationAcceptanceClaim,
  INVITATION_ACCEPTANCE_CLAIM_STATUS,
} from '../utils/invitationAcceptance.util.js';

const usersCollection = firestore.collection('users');
const interviewsCollection = firestore.collection('interviews');
const webrtcCollection = firestore.collection('webrtcSessions');
const organizationsCollection = firestore.collection('organizations');
const organizationMembersCollection = firestore.collection('organizationMembers');
const teamInvitationsCollection = firestore.collection('teamInvitations'); // New: Team member invitations
const jobsCollection = firestore.collection('jobs');
const invitationsCollection = firestore.collection('invitations');
const interviewReviewsCollection = firestore.collection('interviewReviews');
const activityLogsCollection = firestore.collection('activityLogs');
const jobApplicationsCollection = firestore.collection('jobApplications');
const platformAuditLogsCollection = firestore.collection('platformAuditLogs');
const systemSettingsCollection = firestore.collection('systemSettings');
const analyticsSnapshotsCollection = firestore.collection('analyticsSnapshots'); // For historical metrics tracking
const emailVerificationsCollection = firestore.collection('emailVerifications');
const savedAnswersCollection = firestore.collection('savedAnswers'); // GAP FEATURE: Personal Answer Library

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
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  return 0;
};

const DEFAULT_POSTING_DURATION_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const normalizePostingDurationDays = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_POSTING_DURATION_DAYS;
  }
  return parsed;
};

const getJobExpiryMillis = (job) => {
  const explicitExpiry = toMillis(job?.expiresAt);
  if (explicitExpiry > 0) return explicitExpiry;

  const publishedAtMillis = toMillis(job?.publishedAt);
  if (!publishedAtMillis) return 0;

  return publishedAtMillis + normalizePostingDurationDays(job?.postingDuration) * DAY_IN_MS;
};

export const isJobCurrentlyPublic = (job, nowValue = Date.now()) => {
  if (!job) return false;
  if (job.deletedAt) return false;
  if ((job.status || '').toString().toUpperCase() !== 'PUBLISHED') return false;

  const nowMillis = toMillis(nowValue) || Date.now();
  const publishedAtMillis = toMillis(job.publishedAt);

  // Scheduled jobs stay non-public until publishedAt is set by the scheduler.
  if (!publishedAtMillis || publishedAtMillis > nowMillis) return false;

  const expiresAtMillis = getJobExpiryMillis(job);
  if (!expiresAtMillis) return false;

  return expiresAtMillis > nowMillis;
};

const isJobSoftDeleted = (job) => Boolean(job?.deletedAt);

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

const normalizeInterviewListLimit = (value, max = 200) => {
  if (value == null) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return Math.min(parsed, max);
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

  // Alias for compatibility with controllers expecting getById
  async getById(id) {
    return this.getByUid(id);
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

  async findByVerificationHash(verificationHash) {
    if (!verificationHash) return [];
    const snapshot = await usersCollection.where('companyVerificationHash', '==', verificationHash).get();
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
      gender: data.gender || null,
      targetRole: data.targetRole || null,
      careerGoals: data.careerGoals || null,
      location: data.location || null,
      preferredLanguage: data.preferredLanguage || null,
      phoneNumber: data.phoneNumber || null,
      // Candidate education fields
      highestQualification: data.highestQualification || null,
      fieldOfStudy: data.fieldOfStudy || null,
      institutionName: data.institutionName || null,
      graduationYear: data.graduationYear || null,
      // Candidate professional links
      linkedinUrl: data.linkedinUrl || null,
      githubUrl: data.githubUrl || null,
      portfolioUrl: data.portfolioUrl || null,
      // Candidate job preferences
      certifications: data.certifications || [],
      availability: data.availability || null,
      preferredWorkType: data.preferredWorkType || null,
      preferredEmploymentType: data.preferredEmploymentType || null,
      expectedSalary: data.expectedSalary || null,
      // Company fields
      companyName: data.companyName || null,
      companyType: data.companyType || null,
      companySize: data.companySize || null,
      industry: data.industry || null,
      jobTitle: data.jobTitle || null,
      department: data.department || null,
      hiringVolume: data.hiringVolume || null,
      companyWebsite: data.companyWebsite || null,
      companyLocation: data.companyLocation || null,
      businessRegistrationNumber: data.businessRegistrationNumber || null,
      companyEmail: data.companyEmail || null,
      establishedYear: data.establishedYear || null,
      companyLinkedinUrl: data.companyLinkedinUrl || null,
      // Upload fields
      profilePhotoUrl: data.profilePhotoUrl || null,
      resumeUrl: data.resumeUrl || null,
      resumeOriginalName: data.resumeOriginalName || null,
      resumeHash: data.resumeHash || null,
      resumeInsights: data.resumeInsights || null,
      companyLogoUrl: data.companyLogoUrl || null,
      companyVerificationUrl: data.companyVerificationUrl || null,
      companyVerificationOriginalName: data.companyVerificationOriginalName || null,
      companyVerificationHash: data.companyVerificationHash || null,
      companyVerificationInsights: data.companyVerificationInsights || null,
      // Organization
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

  async hasAccountType(accountType) {
    if (!accountType) return false;
    const normalizedType = accountType.toString().toUpperCase();
    try {
      const snapshot = await usersCollection
        .where('accountType', '==', normalizedType)
        .limit(1)
        .get();
      return !snapshot.empty;
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('User accountType index still building; falling back to in-memory scan.');
      const snapshot = await usersCollection.get();
      return snapshot.docs.some((doc) => {
        const user = docToData(doc);
        return (user?.accountType || '').toString().toUpperCase() === normalizedType;
      });
    }
  },

  async list(options = {}) {
    const {
      accountType = null,
      accountStatus = null,
      query = '',
      limit = 100,
      offset = 0,
    } = options;

    const normalizedLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 100, 500));
    const normalizedOffset = Math.max(0, Number.parseInt(offset, 10) || 0);
    const normalizedType = accountType ? accountType.toString().toUpperCase() : null;
    const normalizedStatus = accountStatus ? accountStatus.toString().toUpperCase() : null;
    const normalizedQuery = (query || '').toString().trim().toLowerCase();

    const applyFilters = (users = []) =>
      users.filter((user) => {
        if (normalizedType && (user.accountType || '').toString().toUpperCase() !== normalizedType) {
          return false;
        }
        if (normalizedStatus) {
          const userStatus = (user.accountStatus || 'ACTIVE').toString().toUpperCase();
          if (userStatus !== normalizedStatus) return false;
        }
        if (!normalizedQuery) return true;
        const email = (user.email || '').toString().toLowerCase();
        const fullName = (user.fullName || '').toString().toLowerCase();
        const companyName = (user.companyName || '').toString().toLowerCase();
        return (
          email.includes(normalizedQuery)
          || fullName.includes(normalizedQuery)
          || companyName.includes(normalizedQuery)
          || (user.id || '').toString().toLowerCase().includes(normalizedQuery)
        );
      });

    try {
      let firestoreQuery = usersCollection.orderBy('createdAt', 'desc');
      if (normalizedType) {
        firestoreQuery = firestoreQuery.where('accountType', '==', normalizedType);
      }

      // When search/status filters are present we still fetch a bounded window and refine in-memory.
      const fetchLimit = normalizedQuery || normalizedStatus
        ? Math.min(normalizedLimit + normalizedOffset + 300, 500)
        : normalizedLimit;

      const snapshot = await firestoreQuery
        .limit(fetchLimit)
        .offset(normalizedQuery || normalizedStatus ? 0 : normalizedOffset)
        .get();

      const all = snapshot.docs.map((doc) => docToData(doc));
      const filtered = applyFilters(all);
      const paged = normalizedQuery || normalizedStatus
        ? filtered.slice(normalizedOffset, normalizedOffset + normalizedLimit)
        : filtered;

      return {
        users: paged,
        total: filtered.length,
      };
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('User listing index still building; falling back to in-memory sort/filter.');
      const snapshot = await usersCollection.get();
      const allUsers = snapshot.docs
        .map((doc) => docToData(doc))
        .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));
      const filtered = applyFilters(allUsers);
      return {
        users: filtered.slice(normalizedOffset, normalizedOffset + normalizedLimit),
        total: filtered.length,
      };
    }
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
      scheduledFor: data.scheduledFor || null,
      timezone: data.timezone || null,
      meetingLink: data.meetingLink || null,
      scheduleStatus: data.scheduleStatus || (data.scheduledFor ? 'SCHEDULED' : null),
      scheduledBy: data.scheduledBy || null,
      scheduledAt: data.scheduledAt || null,
      startedAt: data.startedAt || null,
      endedAt: data.endedAt || null,
      transcript: data.transcript || null,
      recordingUrl: data.recordingUrl || null,
      recording: data.recording && typeof data.recording === 'object' ? data.recording : null,
      evaluation: data.evaluation || null,
      overallScore: data.overallScore || null,
      readinessLevel: data.readinessLevel || null,
      createdAt: now(),
      updatedAt: now(),
    };

    await docRef.set(payload);
    await syncRealtimeInterviewSession(payload);
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
    const normalized = docToData(updated);
    await syncRealtimeInterviewSession(normalized);
    return normalized;
  },

  async addQuestions(interviewId, questions = []) {
    if (!questions.length) return [];
    const batch = firestore.batch();
    const questionsCollection = interviewsCollection.doc(interviewId).collection('questions');

    questions.forEach((q, index) => {
      const rawId = q?.id;
      const questionId = typeof rawId === 'string' && rawId.trim()
        ? rawId.trim()
        : (Number.isFinite(Number(rawId)) ? `q_${rawId}` : randomUUID());
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

  async listByCandidate(candidateId, options = {}) {
    if (!candidateId) return [];
    const limit = normalizeInterviewListLimit(options?.limit);
    try {
      let query = interviewsCollection
        .where('candidateId', '==', candidateId)
        .orderBy('createdAt', 'desc');
      if (limit) {
        query = query.limit(limit);
      }
      const snapshot = await query.get();
      return snapshot.docs.map((doc) => docToData(doc));
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('Candidate interviews index still building; falling back to in-memory sort.');
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);
      const snapshot = await interviewsCollection.where('candidateId', '==', candidateId).get();
      let items = snapshot.docs
        .map((doc) => docToData(doc))
        .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));
      if (limit) {
        items = items.slice(0, limit);
      }
      return items;
    }
  },

  async listByCompany(companyId, options = {}) {
    if (!companyId) return [];
    const limit = normalizeInterviewListLimit(options?.limit);
    try {
      let query = interviewsCollection
        .where('companyId', '==', companyId)
        .orderBy('createdAt', 'desc');
      if (limit) {
        query = query.limit(limit);
      }
      const snapshot = await query.get();
      return snapshot.docs.map((doc) => docToData(doc));
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('Company interviews index still building; falling back to in-memory sort.');
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);
      const snapshot = await interviewsCollection.where('companyId', '==', companyId).get();
      let items = snapshot.docs
        .map((doc) => docToData(doc))
        .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));
      if (limit) {
        items = items.slice(0, limit);
      }
      return items;
    }
  },

  async listByOrganization(organizationId, options = {}) {
    if (!organizationId) return [];
    const limit = normalizeInterviewListLimit(options?.limit);
    try {
      let query = interviewsCollection
        .where('organizationId', '==', organizationId)
        .orderBy('createdAt', 'desc');
      if (limit) {
        query = query.limit(limit);
      }
      const snapshot = await query.get();
      return snapshot.docs.map((doc) => docToData(doc));
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('Organization interviews index still building; falling back to in-memory sort.');
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);
      const snapshot = await interviewsCollection.where('organizationId', '==', organizationId).get();
      let items = snapshot.docs
        .map((doc) => docToData(doc))
        .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));
      if (limit) {
        items = items.slice(0, limit);
      }
      return items;
    }
  },

  async listByJob(jobId, options = {}) {
    if (!jobId) return [];
    const limit = normalizeInterviewListLimit(options?.limit);
    try {
      let query = interviewsCollection
        .where('jobId', '==', jobId)
        .orderBy('createdAt', 'desc');
      if (limit) {
        query = query.limit(limit);
      }
      const snapshot = await query.get();
      return snapshot.docs.map((doc) => docToData(doc));
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('Job interviews index still building; falling back to in-memory sort.');
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);
      const snapshot = await interviewsCollection.where('jobId', '==', jobId).get();
      let items = snapshot.docs
        .map((doc) => docToData(doc))
        .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));
      if (limit) {
        items = items.slice(0, limit);
      }
      return items;
    }
  },

  /**
   * List recent interviews (for admin fairness/calibration aggregation).
   * Uses updatedAt desc; filter in memory for status/criteria as needed.
   */
  async listRecent(limit = 500) {
    const snapshot = await interviewsCollection
      .orderBy('updatedAt', 'desc')
      .limit(Math.min(limit, 500))
      .get();
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

  async getByInvitationId(invitationId) {
    if (!invitationId) return null;
    const snapshot = await interviewsCollection.where('invitationId', '==', invitationId).limit(1).get();
    if (snapshot.empty) return null;
    return docToData(snapshot.docs[0]);
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

const REALTIME_FEED_EXCLUDED_EVENTS = new Set(['pose-data']);

const getInterviewParticipantIds = (interview = {}) =>
  Array.from(new Set([interview?.candidateId, interview?.companyId].filter(Boolean)));

const toParticipantMap = (participantIds = []) =>
  participantIds.reduce((acc, participantId) => {
    acc[participantId] = true;
    return acc;
  }, {});

async function resolveRealtimeParticipantIds(interviewId) {
  if (!realtimeDb || !interviewId) return [];

  try {
    const participantsSnapshot = await realtimeDb.ref(`sessions/${interviewId}/participants`).once('value');
    const participantMap = participantsSnapshot.val() || {};
    const participantIds = Object.keys(participantMap).filter((participantId) => participantMap[participantId] === true);
    if (participantIds.length > 0) {
      return participantIds;
    }
  } catch (error) {
    logger.warn(`Failed to resolve realtime participants for interview ${interviewId} from RTDB:`, error);
  }

  const interview = await interviewStore.getById(interviewId);
  if (!interview) return [];

  await syncRealtimeInterviewSession(interview);
  return getInterviewParticipantIds(interview);
}

export async function syncRealtimeInterviewSession(interview = {}) {
  if (!realtimeDb || !interview?.id) return;

  const participantIds = getInterviewParticipantIds(interview);
  const participantMap = toParticipantMap(participantIds);
  const timestamp = now();
  const syncEventId = randomUUID();
  const sessionRef = realtimeDb.ref(`sessions/${interview.id}`);

  try {
    await sessionRef.child('participants').set(participantMap);
    await sessionRef.child('meta').update({
      interviewId: interview.id,
      candidateId: interview.candidateId || null,
      companyId: interview.companyId || null,
      status: interview.status || 'SCHEDULED',
      pipelineStatus: interview.pipelineStatus || null,
      jobStage: interview.jobStage || null,
      overallScore: interview.overallScore ?? null,
      readinessLevel: interview.readinessLevel ?? null,
      updatedAt: timestamp,
    });

    if (participantIds.length > 0) {
      const feedUpdates = {};
      participantIds.forEach((participantId) => {
        const feedBasePath = `userInterviewFeeds/${participantId}/${interview.id}`;
        feedUpdates[`${feedBasePath}/interviewId`] = interview.id;
        feedUpdates[`${feedBasePath}/status`] = interview.status || 'SCHEDULED';
        feedUpdates[`${feedBasePath}/pipelineStatus`] = interview.pipelineStatus || null;
        feedUpdates[`${feedBasePath}/jobStage`] = interview.jobStage || null;
        feedUpdates[`${feedBasePath}/overallScore`] = interview.overallScore ?? null;
        feedUpdates[`${feedBasePath}/readinessLevel`] = interview.readinessLevel ?? null;
        feedUpdates[`${feedBasePath}/lastEventId`] = syncEventId;
        feedUpdates[`${feedBasePath}/lastEventType`] = 'session-synced';
        feedUpdates[`${feedBasePath}/lastEventAt`] = interview.updatedAt || interview.createdAt || timestamp;
        feedUpdates[`${feedBasePath}/updatedAt`] = timestamp;
      });

      await realtimeDb.ref().update(feedUpdates);
    }
  } catch (error) {
    logger.error(`Failed to sync realtime interview session for interview ${interview.id}:`, error);
  }
}

export async function recordRealtimeEvent(interviewId, eventType, payload = {}) {
  if (!realtimeDb || !interviewId) return;

  const eventId = randomUUID();
  const timestamp = now();
  const event = {
    eventId,
    eventType,
    payload,
    timestamp,
  };

  try {
    const sessionRef = realtimeDb.ref(`sessions/${interviewId}`);
    const eventsRef = sessionRef.child('events').push();
    await eventsRef.set(event);
    await sessionRef.child('lastEvent').set(event);

    const metaUpdates = {
      lastEventType: eventType,
      lastEventAt: timestamp,
      updatedAt: timestamp,
    };

    if (typeof payload?.status === 'string' && payload.status.trim()) {
      metaUpdates.status = payload.status.trim();
    }
    if (payload?.overallScore !== undefined) {
      metaUpdates.overallScore = payload.overallScore;
    }
    if (payload?.readinessLevel !== undefined) {
      metaUpdates.readinessLevel = payload.readinessLevel;
    }

    await sessionRef.child('meta').update(metaUpdates);

    if (eventType === 'participant-connected' || eventType === 'participant-disconnected') {
      const actorId = typeof payload?.actor === 'string' ? payload.actor.trim() : '';
      if (actorId) {
        await sessionRef.child(`presence/${actorId}`).update({
          connected: eventType === 'participant-connected',
          role: payload?.role || null,
          socketId: payload?.socketId || null,
          updatedAt: timestamp,
        });
      }
    }

    if (!REALTIME_FEED_EXCLUDED_EVENTS.has(eventType)) {
      const participantIds = await resolveRealtimeParticipantIds(interviewId);
      if (participantIds.length > 0) {
        const feedUpdates = {};
        participantIds.forEach((participantId) => {
          const feedBasePath = `userInterviewFeeds/${participantId}/${interviewId}`;
          feedUpdates[`${feedBasePath}/interviewId`] = interviewId;
          feedUpdates[`${feedBasePath}/lastEventId`] = eventId;
          feedUpdates[`${feedBasePath}/lastEventType`] = eventType;
          feedUpdates[`${feedBasePath}/lastEventAt`] = timestamp;
          feedUpdates[`${feedBasePath}/updatedAt`] = timestamp;

          if (typeof payload?.status === 'string' && payload.status.trim()) {
            feedUpdates[`${feedBasePath}/status`] = payload.status.trim();
          }
          if (payload?.overallScore !== undefined) {
            feedUpdates[`${feedBasePath}/overallScore`] = payload.overallScore;
          }
          if (payload?.readinessLevel !== undefined) {
            feedUpdates[`${feedBasePath}/readinessLevel`] = payload.readinessLevel;
          }
          if (typeof payload?.questionId === 'string' && payload.questionId.trim()) {
            feedUpdates[`${feedBasePath}/lastQuestionId`] = payload.questionId.trim();
          }
        });

        await realtimeDb.ref().update(feedUpdates);
      }
    }
  } catch (error) {
    logger.error('Failed to record realtime event:', error);
  }
}

const buildPublicSystemSettingsPayload = (settings = {}) => ({
  maintenanceMode: Boolean(settings.maintenanceMode),
  nonverbalFeedbackEnabled: settings.nonverbalFeedbackEnabled !== false,
  updatedAt: now(),
});

export async function syncPublicSystemSettings(settings = {}) {
  if (!realtimeDb) return;

  try {
    await realtimeDb.ref('public/systemSettings').set(
      buildPublicSystemSettingsPayload(settings),
    );
  } catch (error) {
    logger.error('Failed to sync public system settings to realtime database:', error);
  }
}

const buildRealtimeFeedPayload = (eventType, payload = {}, timestamp = now()) => ({
  lastEventId: randomUUID(),
  lastEventType: eventType || 'updated',
  lastEventAt: timestamp,
  updatedAt: timestamp,
  payload: payload && typeof payload === 'object' ? payload : {},
});

const writeRealtimeFeed = async (feedPath, eventType, payload = {}) => {
  if (!realtimeDb || !feedPath) return null;

  const timestamp = now();
  const feedPayload = buildRealtimeFeedPayload(eventType, payload, timestamp);

  try {
    await realtimeDb.ref(feedPath).update(feedPayload);
    return feedPayload;
  } catch (error) {
    logger.error(`Failed to write realtime feed at "${feedPath}":`, error);
    return null;
  }
};

export async function publishOrganizationRealtimeUpdate(organizationId, eventType, payload = {}) {
  if (!organizationId) return null;
  return writeRealtimeFeed(`organizationFeeds/${organizationId}`, eventType, payload);
}

export async function publishCandidateRealtimeUpdate(userId, eventType, payload = {}) {
  if (!userId) return null;
  return writeRealtimeFeed(`candidateFeeds/${userId}`, eventType, payload);
}

export async function publishPublicRealtimeUpdate(channel, eventType, payload = {}) {
  const safeChannel = typeof channel === 'string' && channel.trim() ? channel.trim() : 'global';
  return writeRealtimeFeed(`publicFeeds/${safeChannel}`, eventType, payload);
}

export async function publishAdminRealtimeUpdate(eventType, payload = {}) {
  return writeRealtimeFeed('adminFeeds/global', eventType, payload);
}

const isMembershipActive = (status) => (status || 'ACTIVE').toString().toUpperCase() === 'ACTIVE';

export async function syncUserOrganizationRealtimeMembership({
  userId,
  organizationId,
  active = true,
} = {}) {
  if (!realtimeDb || !userId || !organizationId) return;

  try {
    const memberPathRef = realtimeDb.ref(`userOrganizationMap/${userId}/${organizationId}`);
    if (active) {
      await memberPathRef.set(true);
    } else {
      await memberPathRef.remove();
    }
  } catch (error) {
    logger.error(
      `Failed to sync realtime organization membership (user=${userId}, organization=${organizationId}, active=${active}):`,
      error,
    );
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

const ACTIVE_CANDIDATE_APPLICATION_STATUSES = new Set(['SUBMITTED', 'SCREENING', 'INTERVIEWING', 'SHORTLISTED']);
const STRONG_SIGNAL_APPLICATION_STATUSES = new Set(['SHORTLISTED', 'INTERVIEWING', 'HIRED']);

const formatDurationMinutes = (value) => {
  const totalMinutes = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
};

const extractInterviewDurationMinutes = (interview = {}) => {
  const startedAtMillis = toMillis(interview?.startedAt);
  const endedAtMillis = toMillis(interview?.endedAt);
  if (startedAtMillis > 0 && endedAtMillis > startedAtMillis) {
    const elapsedMinutes = Math.round((endedAtMillis - startedAtMillis) / (1000 * 60));
    if (elapsedMinutes > 0) return elapsedMinutes;
  }

  const plannedDuration = Number.parseInt(interview?.duration, 10);
  if (Number.isFinite(plannedDuration) && plannedDuration > 0) {
    return plannedDuration;
  }

  return String(interview?.status || '').toUpperCase() === 'COMPLETED' ? 30 : 0;
};

const calculateDurationChange = (current, previous) => {
  const currentMinutes = Math.max(0, Math.round(Number(current) || 0));
  const previousMinutes = Number.isFinite(Number(previous)) ? Math.max(0, Math.round(Number(previous))) : null;

  if (!currentMinutes) {
    return {
      value: 0,
      formatted: formatDurationMinutes(0),
      changeText: 'No practice time yet',
      changeType: 'neutral',
    };
  }

  if (previousMinutes === null) {
    return {
      value: currentMinutes,
      formatted: formatDurationMinutes(currentMinutes),
      changeText: 'New',
      changeType: 'neutral',
    };
  }

  const diff = currentMinutes - previousMinutes;
  if (diff === 0) {
    return {
      value: currentMinutes,
      formatted: formatDurationMinutes(currentMinutes),
      changeText: 'No change',
      changeType: 'neutral',
    };
  }

  const sign = diff > 0 ? '+' : '-';
  return {
    value: currentMinutes,
    formatted: formatDurationMinutes(currentMinutes),
    changeText: `${sign}${formatDurationMinutes(Math.abs(diff))} this week`,
    changeType: diff > 0 ? 'positive' : 'negative',
  };
};

const toInsightDateLabel = (value) => {
  const millis = toMillis(value);
  if (!millis) return null;
  return new Date(millis).toLocaleDateString();
};

const buildCandidateInsights = ({ currentMetrics, previousMetrics }) => {
  const insights = [];
  const averageScore = Number(currentMetrics?.averageScore) || 0;
  const completedInterviews = Number(currentMetrics?.completedInterviews) || 0;
  const activeInterviews = (Number(currentMetrics?.scheduledInterviews) || 0) + (Number(currentMetrics?.inProgressInterviews) || 0);
  const activeApplications = Number(currentMetrics?.activeApplications) || 0;
  const strongSignalApplications = Number(currentMetrics?.strongSignalApplications) || 0;
  const nextScheduledLabel = toInsightDateLabel(currentMetrics?.nextScheduledFor);
  const remainingForMilestone = Math.max(1, 5 - completedInterviews);

  if (averageScore > 0 && completedInterviews > 0) {
    insights.push({
      id: 'score-trend',
      color: averageScore >= 85 ? 'green' : (averageScore >= 70 ? 'blue' : 'amber'),
      title: `Average interview score ${Math.round(averageScore)}%`,
      detail: completedInterviews > 1
        ? `Based on ${completedInterviews} completed interviews.`
        : 'Based on your first completed interview.',
    });
  } else {
    insights.push({
      id: 'score-baseline',
      color: 'blue',
      title: 'No scored interviews yet',
      detail: 'Complete a practice interview to unlock score trends and confidence tracking.',
    });
  }

  if (activeInterviews > 0) {
    insights.push({
      id: 'pipeline-active',
      color: 'green',
      title: `${activeInterviews} active interview${activeInterviews === 1 ? '' : 's'} in your pipeline`,
      detail: nextScheduledLabel
        ? `Next scheduled interview on ${nextScheduledLabel}.`
        : 'Keep your interview schedule updated to stay prepared.',
    });
  } else if (activeApplications > 0) {
    insights.push({
      id: 'pipeline-applications',
      color: 'blue',
      title: `${activeApplications} active application${activeApplications === 1 ? '' : 's'} awaiting interview stages`,
      detail: 'Keep practicing while waiting for recruiter responses.',
    });
  } else {
    insights.push({
      id: 'pipeline-empty',
      color: 'amber',
      title: 'Interview pipeline is currently empty',
      detail: 'Apply to roles or start AI practice to build momentum.',
    });
  }

  if (strongSignalApplications > 0) {
    insights.push({
      id: 'coaching-signal',
      color: 'green',
      title: `${strongSignalApplications} application${strongSignalApplications === 1 ? '' : 's'} in strong-signal stages`,
      detail: 'Prepare targeted stories for shortlist and interview-round conversations.',
    });
  } else if (completedInterviews >= 5) {
    insights.push({
      id: 'coaching-consistency',
      color: 'blue',
      title: 'Consistency milestone unlocked',
      detail: `${completedInterviews} completed interviews gives you a strong preparation base.`,
    });
  } else if (completedInterviews > 0) {
    insights.push({
      id: 'coaching-momentum',
      color: 'amber',
      title: 'Keep momentum toward your consistency goal',
      detail: `${remainingForMilestone} more session${remainingForMilestone === 1 ? '' : 's'} to reach your first 5-session milestone.`,
    });
  } else {
    insights.push({
      id: 'coaching-kickoff',
      color: 'amber',
      title: 'Opportunity: strengthen communication structure',
      detail: 'Use quick-start practice to build STAR-based response confidence.',
    });
  }

  // Prefer trend context when historical snapshot exists and score improved.
  if (previousMetrics && Number(previousMetrics?.averageScore) > 0 && averageScore > Number(previousMetrics.averageScore)) {
    insights[0] = {
      ...insights[0],
      detail: `Improved from ${Math.round(previousMetrics.averageScore)}% over last week.`,
    };
  }

  return insights;
};

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

  /**
   * Get dashboard metrics with historical comparison data (week-over-week)
   * @param {string} organizationId - The organization ID
   * @returns {Object} Metrics with change indicators
   */
  async getDashboardMetricsWithComparison(organizationId) {
    try {
      // Get current metrics
      const currentMetrics = await this.getCurrentOrganizationMetrics(organizationId);
      
      // Get snapshot from 7 days ago for comparison
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const previousMetrics = await this.getSnapshotNearDate(organizationId, oneWeekAgo);

      // Calculate changes
      const calculateChange = (current, previous, suffix = '', isInterviews = false) => {
        if (previous === null || previous === undefined) {
          return { value: current, changeText: 'New', changeType: 'neutral' };
        }
        const diff = current - previous;
        if (diff === 0) {
          return { value: current, changeText: 'No change', changeType: 'neutral' };
        }
        if (isInterviews) {
          // For interviews, use "X more than last week" or "X fewer than last week"
          const absDiff = Math.abs(diff);
          const direction = diff > 0 ? 'more' : 'fewer';
          return {
            value: current,
            changeText: `${absDiff} ${direction} than last week`,
            changeType: diff > 0 ? 'positive' : 'negative',
          };
        }
        const sign = diff > 0 ? '+' : '';
        return {
          value: current,
          changeText: `${sign}${diff}${suffix} this week`,
          changeType: diff > 0 ? 'positive' : 'negative',
        };
      };

      // Special handling for pending reviews (lower is better)
      const calculatePendingChange = (current, previous) => {
        if (previous === null || previous === undefined) {
          return { 
            value: current, 
            changeText: current > 0 ? `${current} pending` : 'All caught up', 
            changeType: current > 0 ? 'urgent' : 'positive' 
          };
        }
        const diff = current - previous;
        if (diff === 0) {
          return { 
            value: current, 
            changeText: current > 0 ? `${current} pending` : 'All caught up', 
            changeType: current > 0 ? 'urgent' : 'positive' 
          };
        }
        const sign = diff > 0 ? '+' : '';
        return {
          value: current,
          changeText: `${sign}${diff} pending`,
          changeType: diff > 0 ? 'urgent' : 'positive', // More pending = urgent, less = positive
        };
      };

      return {
        activeJobPostings: calculateChange(
          currentMetrics.activeJobPostings,
          previousMetrics?.activeJobPostings
        ),
        pendingReviews: calculatePendingChange(
          currentMetrics.pendingReviews,
          previousMetrics?.pendingReviews
        ),
        upcomingInterviews: calculateChange(
          currentMetrics.upcomingInterviews,
          previousMetrics?.upcomingInterviews,
          '',
          true // Mark as interviews to use "more/fewer than last week" format
        ),
        // Additional metrics
        totalInterviews: currentMetrics.totalInterviews,
        completedInterviews: currentMetrics.completedInterviews,
        averageScore: currentMetrics.averageScore,
        totalCandidates: currentMetrics.totalCandidates,
        hiredCount: currentMetrics.hiredCount,
        snapshotDate: currentMetrics.snapshotDate,
      };
    } catch (error) {
      logger.error('getDashboardMetricsWithComparison error:', error);
      // Return basic metrics without comparison on error
      const current = await this.getCurrentOrganizationMetrics(organizationId);
      return {
        activeJobPostings: { value: current.activeJobPostings, changeText: '', changeType: 'neutral' },
        pendingReviews: { value: current.pendingReviews, changeText: current.pendingReviews > 0 ? `${current.pendingReviews} pending` : 'All caught up', changeType: current.pendingReviews > 0 ? 'urgent' : 'positive' },
        upcomingInterviews: { value: current.upcomingInterviews, changeText: '', changeType: 'neutral' },
        totalInterviews: current.totalInterviews,
        completedInterviews: current.completedInterviews,
        averageScore: current.averageScore,
        totalCandidates: current.totalCandidates,
        hiredCount: current.hiredCount,
        snapshotDate: current.snapshotDate,
      };
    }
  },

  /**
   * Get current organization metrics (live data)
   * @param {string} organizationId - The organization ID
   * @returns {Object} Current metrics
   */
  async getCurrentOrganizationMetrics(organizationId) {
    // Get all jobs for the organization
    const jobsSnapshot = await jobsCollection
      .where('organizationId', '==', organizationId)
      .get();
    const jobs = jobsSnapshot.docs.map(docToData);
    const activeJobPostings = jobs.filter((job) => isJobCurrentlyPublic(job)).length;

    // Get all interviews for the organization
    const interviewsSnapshot = await interviewsCollection
      .where('organizationId', '==', organizationId)
      .get();
    const interviews = interviewsSnapshot.docs.map(docToData);
    
    // Calculate metrics
    const completedInterviews = interviews.filter(i => i?.status === 'COMPLETED');
    const pendingReviews = completedInterviews.filter(i => !i?.evaluation).length;
    const scheduledInterviews = interviews.filter(i => i?.status === 'SCHEDULED');
    
    // Get upcoming interviews (scheduled for today or future)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingInterviews = scheduledInterviews.filter(i => {
      const scheduledDate = i?.scheduledFor ? new Date(i.scheduledFor) : null;
      return scheduledDate && scheduledDate >= today;
    }).length;

    // Get pipeline data for hired count
    const hiredCount = interviews.filter(i => i?.pipelineStatus === 'HIRED').length;

    // Calculate average score
    const scoredInterviews = completedInterviews.filter(i => i?.overallScore != null);
    const averageScore = scoredInterviews.length > 0
      ? scoredInterviews.reduce((sum, i) => sum + (i.overallScore || 0), 0) / scoredInterviews.length
      : 0;

    // Get application count (total unique candidates)
    const applicationsSnapshot = await jobApplicationsCollection
      .where('organizationId', '==', organizationId)
      .get();
    const totalCandidates = applicationsSnapshot.size;

    return {
      activeJobPostings,
      pendingReviews,
      upcomingInterviews,
      totalInterviews: interviews.length,
      completedInterviews: completedInterviews.length,
      averageScore: Math.round(averageScore * 100) / 100,
      totalCandidates,
      hiredCount,
      snapshotDate: now(),
    };
  },

  /**
   * Create a daily snapshot of organization metrics for historical tracking
   * @param {string} organizationId - The organization ID
   * @returns {Object} The created snapshot
   */
  async createDailySnapshot(organizationId) {
    try {
      const today = new Date();
      const dateKey = today.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Check if a snapshot already exists for today
      const existingSnapshot = await analyticsSnapshotsCollection
        .where('organizationId', '==', organizationId)
        .where('dateKey', '==', dateKey)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        // Update existing snapshot
        const existingDoc = existingSnapshot.docs[0];
        const metrics = await this.getCurrentOrganizationMetrics(organizationId);
        await existingDoc.ref.update({
          ...metrics,
          updatedAt: now(),
        });
        return { id: existingDoc.id, ...existingDoc.data(), ...metrics };
      }

      // Create new snapshot
      const metrics = await this.getCurrentOrganizationMetrics(organizationId);
      const docRef = analyticsSnapshotsCollection.doc();
      const snapshot = {
        id: docRef.id,
        organizationId,
        dateKey,
        ...metrics,
        createdAt: now(),
        updatedAt: now(),
      };

      await docRef.set(snapshot);
      logger.info(`Created daily analytics snapshot for org ${organizationId}: ${dateKey}`);
      return snapshot;
    } catch (error) {
      logger.error('createDailySnapshot error:', error);
      throw error;
    }
  },

  /**
   * Get the snapshot nearest to a specific date
   * @param {string} organizationId - The organization ID
   * @param {Date} targetDate - The target date to find snapshot for
   * @returns {Object|null} The snapshot or null if not found
   */
  async getSnapshotNearDate(organizationId, targetDate) {
    try {
      const dateKey = targetDate.toISOString().split('T')[0];
      
      // Try to find exact date match first
      let snapshot = await analyticsSnapshotsCollection
        .where('organizationId', '==', organizationId)
        .where('dateKey', '==', dateKey)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        return docToData(snapshot.docs[0]);
      }

      // If no exact match, find the nearest snapshot before the target date
      snapshot = await analyticsSnapshotsCollection
        .where('organizationId', '==', organizationId)
        .where('dateKey', '<=', dateKey)
        .orderBy('dateKey', 'desc')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        return docToData(snapshot.docs[0]);
      }

      return null;
    } catch (error) {
      // Handle index building error gracefully
      if (isIndexBuildingError(error)) {
        logger.warn('Analytics snapshot index not ready, returning null for comparison');
        console.error('Firestore index error - click the link below to create the index:');
        console.error(error.message || error);
        return null;
      }
      logger.error('getSnapshotNearDate error:', error);
      return null;
    }
  },

  /**
   * Get historical snapshots for trend analysis
   * @param {string} organizationId - The organization ID
   * @param {number} days - Number of days of history to retrieve
   * @returns {Array} Array of snapshots
   */
  async getSnapshots(organizationId, days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateKey = startDate.toISOString().split('T')[0];

      const snapshot = await analyticsSnapshotsCollection
        .where('organizationId', '==', organizationId)
        .where('dateKey', '>=', startDateKey)
        .orderBy('dateKey', 'desc')
        .get();

      return snapshot.docs.map(docToData);
    } catch (error) {
      if (isIndexBuildingError(error)) {
        logger.warn('Analytics snapshot index not ready, returning empty array');
        console.error('Firestore index error - click the link below to create the index:');
        console.error(error.message || error);
        return [];
      }
      logger.error('getSnapshots error:', error);
      return [];
    }
  },

  // ============================================
  // CANDIDATE ANALYTICS FUNCTIONS
  // ============================================

  /**
   * Get current candidate metrics (live data)
   * @param {string} candidateId - The candidate user ID
   * @returns {Object} Current metrics
   */
  async getCurrentCandidateMetrics(candidateId) {
    const interviews = await interviewStore.listByCandidate(candidateId);
    const applications = await jobApplicationStore.listByCandidate(candidateId);
    
    const completedInterviews = interviews.filter(i => i?.status === 'COMPLETED');
    const scheduledInterviews = interviews.filter(i => i?.status === 'SCHEDULED');
    const inProgressInterviews = interviews.filter(i => i?.status === 'IN_PROGRESS');
    const totalPracticeMinutes = completedInterviews.reduce(
      (sum, interview) => sum + extractInterviewDurationMinutes(interview),
      0,
    );
    const activeApplications = applications.filter((application) =>
      ACTIVE_CANDIDATE_APPLICATION_STATUSES.has(String(application?.status || '').toUpperCase())).length;
    const strongSignalApplications = applications.filter((application) =>
      STRONG_SIGNAL_APPLICATION_STATUSES.has(String(application?.status || '').toUpperCase())).length;
    const nextScheduledFor = scheduledInterviews
      .map((interview) => interview?.scheduledFor)
      .filter(Boolean)
      .sort((left, right) => toMillis(left) - toMillis(right))[0] || null;
    
    // Calculate average score from completed interviews
    const scoredInterviews = completedInterviews.filter(i => i?.overallScore != null);
    const averageScore = scoredInterviews.length > 0
      ? scoredInterviews.reduce((sum, i) => sum + (i.overallScore || 0), 0) / scoredInterviews.length
      : 0;

    // Calculate grade based on average score
    const getGrade = (score) => {
      if (!score || score === 0) return null;
      if (score >= 90) return 'A+';
      if (score >= 85) return 'A';
      if (score >= 80) return 'B+';
      if (score >= 75) return 'B';
      if (score >= 70) return 'C+';
      if (score >= 65) return 'C';
      return 'D';
    };

    return {
      totalInterviews: interviews.length,
      completedInterviews: completedInterviews.length,
      scheduledInterviews: scheduledInterviews.length,
      inProgressInterviews: inProgressInterviews.length,
      averageScore: Math.round(averageScore * 100) / 100,
      currentGrade: getGrade(averageScore),
      totalPracticeMinutes,
      totalPracticeTimeFormatted: formatDurationMinutes(totalPracticeMinutes),
      activeApplications,
      strongSignalApplications,
      nextScheduledFor,
      snapshotDate: now(),
    };
  },

  /**
   * Get candidate dashboard metrics with historical comparison (week-over-week)
   * @param {string} candidateId - The candidate user ID
   * @returns {Object} Metrics with change indicators
   */
  async getCandidateDashboardMetricsWithComparison(candidateId) {
    try {
      // Get current metrics
      const currentMetrics = await this.getCurrentCandidateMetrics(candidateId);
      
      // Get snapshot from 7 days ago for comparison
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const previousMetrics = await this.getCandidateSnapshotNearDate(candidateId, oneWeekAgo);

      // Calculate changes
      const calculateChange = (current, previous, suffix = '') => {
        if (previous === null || previous === undefined) {
          return { value: current, changeText: 'New', changeType: 'neutral' };
        }
        const diff = current - previous;
        if (diff === 0) {
          return { value: current, changeText: 'No change', changeType: 'neutral' };
        }
        const sign = diff > 0 ? '+' : '';
        return {
          value: current,
          changeText: `${sign}${diff}${suffix} this week`,
          changeType: diff > 0 ? 'positive' : 'negative',
        };
      };

      // Special handling for score (show percentage change)
      const calculateScoreChange = (current, previous) => {
        if (!current || current === 0) {
          return { value: current, changeText: 'No scores yet', changeType: 'neutral' };
        }
        if (previous === null || previous === undefined || previous === 0) {
          return { value: current, changeText: 'First score!', changeType: 'positive' };
        }
        const diff = Math.round(current - previous);
        if (diff === 0) {
          return { value: current, changeText: 'Steady', changeType: 'neutral' };
        }
        const sign = diff > 0 ? '+' : '';
        return {
          value: current,
          changeText: `${sign}${diff}% this week`,
          changeType: diff > 0 ? 'positive' : 'negative',
        };
      };

      // Grade change
      const calculateGradeChange = (current, previous) => {
        if (!current) {
          return { value: '—', changeText: 'Complete interviews to get a grade', changeType: 'neutral' };
        }
        if (!previous) {
          return { value: current, changeText: 'First grade!', changeType: 'positive' };
        }
        if (current === previous) {
          return { value: current, changeText: 'Maintained', changeType: 'neutral' };
        }
        // Grade improved (A+ > A > B+ > B > C+ > C > D)
        const gradeOrder = ['D', 'C', 'C+', 'B', 'B+', 'A', 'A+'];
        const currentIdx = gradeOrder.indexOf(current);
        const prevIdx = gradeOrder.indexOf(previous);
        const improved = currentIdx > prevIdx;
        return {
          value: current,
          changeText: improved ? `↑ from ${previous}` : `↓ from ${previous}`,
          changeType: improved ? 'positive' : 'negative',
        };
      };

      return {
        completedInterviews: calculateChange(
          currentMetrics.completedInterviews,
          previousMetrics?.completedInterviews
        ),
        scheduledInterviews: calculateChange(
          currentMetrics.scheduledInterviews,
          previousMetrics?.scheduledInterviews
        ),
        averageScore: calculateScoreChange(
          currentMetrics.averageScore,
          previousMetrics?.averageScore
        ),
        currentGrade: calculateGradeChange(
          currentMetrics.currentGrade,
          previousMetrics?.currentGrade
        ),
        totalPracticeTime: calculateDurationChange(
          currentMetrics.totalPracticeMinutes,
          previousMetrics?.totalPracticeMinutes
        ),
        // Additional metrics without comparison
        totalInterviews: currentMetrics.totalInterviews,
        inProgressInterviews: currentMetrics.inProgressInterviews,
        insights: buildCandidateInsights({
          currentMetrics,
          previousMetrics,
        }),
        snapshotDate: currentMetrics.snapshotDate,
      };
    } catch (error) {
      logger.error('getCandidateDashboardMetricsWithComparison error:', error);
      // Return basic metrics without comparison on error
      const current = await this.getCurrentCandidateMetrics(candidateId);
      return {
        completedInterviews: { value: current.completedInterviews, changeText: '', changeType: 'neutral' },
        scheduledInterviews: { value: current.scheduledInterviews, changeText: '', changeType: 'neutral' },
        averageScore: { value: current.averageScore, changeText: '', changeType: 'neutral' },
        currentGrade: { value: current.currentGrade || '—', changeText: '', changeType: 'neutral' },
        totalPracticeTime: {
          value: current.totalPracticeMinutes || 0,
          formatted: current.totalPracticeTimeFormatted || formatDurationMinutes(0),
          changeText: '',
          changeType: 'neutral',
        },
        totalInterviews: current.totalInterviews,
        inProgressInterviews: current.inProgressInterviews,
        insights: buildCandidateInsights({
          currentMetrics: current,
          previousMetrics: null,
        }),
        snapshotDate: current.snapshotDate,
      };
    }
  },

  /**
   * Create a daily snapshot of candidate metrics for historical tracking
   * @param {string} candidateId - The candidate user ID
   * @returns {Object} The created snapshot
   */
  async createCandidateDailySnapshot(candidateId) {
    try {
      const today = new Date();
      const dateKey = today.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Check if a snapshot already exists for today
      const existingSnapshot = await analyticsSnapshotsCollection
        .where('candidateId', '==', candidateId)
        .where('dateKey', '==', dateKey)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        // Update existing snapshot
        const existingDoc = existingSnapshot.docs[0];
        const metrics = await this.getCurrentCandidateMetrics(candidateId);
        await existingDoc.ref.update({
          ...metrics,
          updatedAt: now(),
        });
        return { id: existingDoc.id, ...existingDoc.data(), ...metrics };
      }

      // Create new snapshot
      const metrics = await this.getCurrentCandidateMetrics(candidateId);
      const docRef = analyticsSnapshotsCollection.doc();
      const snapshot = {
        id: docRef.id,
        candidateId,
        dateKey,
        type: 'candidate', // Distinguish from organization snapshots
        ...metrics,
        createdAt: now(),
        updatedAt: now(),
      };

      await docRef.set(snapshot);
      logger.info(`Created daily candidate analytics snapshot for user ${candidateId}: ${dateKey}`);
      return snapshot;
    } catch (error) {
      logger.error('createCandidateDailySnapshot error:', error);
      throw error;
    }
  },

  /**
   * Get the candidate snapshot nearest to a specific date
   * @param {string} candidateId - The candidate user ID
   * @param {Date} targetDate - The target date to find snapshot for
   * @returns {Object|null} The snapshot or null if not found
   */
  async getCandidateSnapshotNearDate(candidateId, targetDate) {
    try {
      const dateKey = targetDate.toISOString().split('T')[0];
      
      // Try to find exact date match first
      let snapshot = await analyticsSnapshotsCollection
        .where('candidateId', '==', candidateId)
        .where('dateKey', '==', dateKey)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        return docToData(snapshot.docs[0]);
      }

      // If no exact match, find the nearest snapshot before the target date
      snapshot = await analyticsSnapshotsCollection
        .where('candidateId', '==', candidateId)
        .where('dateKey', '<=', dateKey)
        .orderBy('dateKey', 'desc')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        return docToData(snapshot.docs[0]);
      }

      return null;
    } catch (error) {
      // Handle index building error gracefully
      if (isIndexBuildingError(error)) {
        logger.warn('Candidate analytics snapshot index not ready, returning null for comparison');
        console.error('Firestore index error - click the link below to create the index:');
        console.error(error.message || error);
        return null;
      }
      logger.error('getCandidateSnapshotNearDate error:', error);
      return null;
    }
  },

  /**
   * Get candidate historical snapshots for trend analysis
   * @param {string} candidateId - The candidate user ID
   * @param {number} days - Number of days of history to retrieve
   * @returns {Array} Array of snapshots
   */
  async getCandidateSnapshots(candidateId, days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateKey = startDate.toISOString().split('T')[0];

      const snapshot = await analyticsSnapshotsCollection
        .where('candidateId', '==', candidateId)
        .where('dateKey', '>=', startDateKey)
        .orderBy('dateKey', 'desc')
        .get();

      return snapshot.docs.map(docToData);
    } catch (error) {
      if (isIndexBuildingError(error)) {
        logger.warn('Candidate analytics snapshot index not ready, returning empty array');
        console.error('Firestore index error - click the link below to create the index:');
        console.error(error.message || error);
        return [];
      }
      logger.error('getCandidateSnapshots error:', error);
      return [];
    }
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
      address: data.address || null,
      description: data.description || null,
      facebookUrl: data.facebookUrl || null,
      linkedinUrl: data.linkedinUrl || null,
      youtubeUrl: data.youtubeUrl || null,
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
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);
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
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);
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
    const organization = organizationDocToData(updated);

    // Update Realtime Database for real-time notification to waiting users
    if (organization && realtimeDb) {
      try {
        await realtimeDb.ref(`organizationApprovalStatus/${id}`).update({
          status: 'APPROVED',
          approvedBy: approvedBy || null,
          approvedAt: now(),
          updatedAt: now(),
        });
        logger.info(`Updated organization approval status in Realtime DB: ${id} - APPROVED`);
      } catch (rtdbError) {
        logger.error('Failed to update organization approval status in Realtime DB:', rtdbError);
        // Don't fail the approval if RTDB update fails
      }
    }

    return organization;
  },

  async reject(
    id,
    {
      reason,
      rejectedBy = null,
      reasonCode = 'OTHER',
      reasonTags = [],
      reasonTagOther = null,
    } = {},
  ) {
    if (!id) throw new Error('Organization ID is required');
    if (!reason || !reason.trim()) {
      throw new Error('Rejection reason is required');
    }

    const docRef = organizationsCollection.doc(id);
    const currentDoc = await docRef.get();
    const current = organizationDocToData(currentDoc);

    if (!current) {
      throw new Error('Organization not found');
    }

    const normalizedReason = reason.trim();
    const normalizedReasonCode = (reasonCode || 'OTHER').toString().trim().toUpperCase() || 'OTHER';
    const normalizedReasonTags = Array.isArray(reasonTags)
      ? Array.from(
          new Set(
            reasonTags
              .map((tag) => (tag || '').toString().trim().toUpperCase())
              .filter(Boolean),
          ),
        ).slice(0, 8)
      : [];
    const normalizedReasonTagOther = normalizedReasonTags.includes('OTHER') && reasonTagOther
      ? String(reasonTagOther).trim() || null
      : null;
    const rejectedAt = now();
    const rejectionEntry = {
      rejectedAt,
      rejectedBy: rejectedBy || null,
      reason: normalizedReason,
      reasonCode: normalizedReasonCode,
      reasonTags: normalizedReasonTags,
      reasonTagOther: normalizedReasonTagOther,
    };
    const rejectionHistory = Array.isArray(current.rejectionHistory)
      ? [...current.rejectionHistory, rejectionEntry]
      : [rejectionEntry];

    await docRef.set(
      {
        status: 'REJECTED',
        rejectedReason: normalizedReason,
        rejectedReasonCode: normalizedReasonCode,
        rejectedReasonTags: normalizedReasonTags,
        rejectedReasonTagOther: normalizedReasonTagOther,
        rejectedBy: rejectedBy || null,
        rejectedAt,
        rejectionHistory,
        reReviewRequestedAt: null,
        reReviewRequestedBy: null,
        reReviewRequestNote: null,
        updatedAt: now(),
      },
      { merge: true },
    );
    const updated = await docRef.get();
    const organization = organizationDocToData(updated);

    // Update Realtime Database for real-time notification to waiting users
    if (organization && realtimeDb) {
      try {
        await realtimeDb.ref(`organizationApprovalStatus/${id}`).update({
          status: 'REJECTED',
          rejectedReason: normalizedReason,
          rejectedReasonCode: normalizedReasonCode,
          rejectedReasonTags: normalizedReasonTags,
          rejectedReasonTagOther: normalizedReasonTagOther,
          rejectedBy: rejectedBy || null,
          rejectedAt,
          reReviewRequestedAt: null,
          reReviewRequestNote: null,
          updatedAt: now(),
        });
        logger.info(`Updated organization approval status in Realtime DB: ${id} - REJECTED`);
      } catch (rtdbError) {
        logger.error('Failed to update organization approval status in Realtime DB:', rtdbError);
        // Don't fail the rejection if RTDB update fails
      }
    }

    return organization;
  },

  async requestReReview(id, { requestedBy = null, note } = {}) {
    if (!id) throw new Error('Organization ID is required');
    if (!note || !note.trim()) {
      throw new Error('Re-review note is required');
    }

    const docRef = organizationsCollection.doc(id);
    const currentDoc = await docRef.get();
    const current = organizationDocToData(currentDoc);

    if (!current) {
      throw new Error('Organization not found');
    }

    const normalizedNote = note.trim();
    const requestedAt = now();
    const currentCount = Number.isFinite(current.reReviewRequestCount) ? current.reReviewRequestCount : 0;
    const requestEntry = {
      requestedAt,
      requestedBy: requestedBy || null,
      note: normalizedNote,
      previousRejectedReason: current.rejectedReason || null,
      previousRejectedReasonCode: current.rejectedReasonCode || null,
    };
    const reReviewRequests = Array.isArray(current.reReviewRequests)
      ? [...current.reReviewRequests, requestEntry]
      : [requestEntry];

    await docRef.set(
      {
        status: 'PENDING',
        reReviewRequestedAt: requestedAt,
        reReviewRequestedBy: requestedBy || null,
        reReviewRequestNote: normalizedNote,
        reReviewRequestCount: currentCount + 1,
        reReviewRequests,
        updatedAt: now(),
      },
      { merge: true },
    );

    const updated = await docRef.get();
    const organization = organizationDocToData(updated);

    // Update Realtime Database for real-time notification to waiting users
    if (organization && realtimeDb) {
      try {
        await realtimeDb.ref(`organizationApprovalStatus/${id}`).update({
          status: 'PENDING',
          reReviewRequestedAt: requestedAt,
          reReviewRequestedBy: requestedBy || null,
          reReviewRequestNote: normalizedNote,
          updatedAt: now(),
        });
        logger.info(`Updated organization approval status in Realtime DB: ${id} - PENDING (re-review requested)`);
      } catch (rtdbError) {
        logger.error('Failed to update organization approval status in Realtime DB:', rtdbError);
        // Don't fail the re-review request if RTDB update fails
      }
    }

    return organization;
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
    const organization = organizationDocToData(updated);

    if (organization && realtimeDb) {
      try {
        await realtimeDb.ref(`organizationApprovalStatus/${id}`).update({
          status: 'SUSPENDED',
          suspensionReason: reason.trim(),
          suspendedBy: suspendedBy || null,
          suspendedAt: now(),
          updatedAt: now(),
        });
        logger.info(`Updated organization approval status in Realtime DB: ${id} - SUSPENDED`);
      } catch (rtdbError) {
        logger.error('Failed to update organization approval status in Realtime DB:', rtdbError);
      }
    }

    return organization;
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
    const organization = organizationDocToData(updated);

    if (organization && realtimeDb) {
      try {
        await realtimeDb.ref(`organizationApprovalStatus/${id}`).update({
          status: 'APPROVED',
          suspensionReason: null,
          suspendedAt: null,
          suspendedBy: null,
          updatedAt: now(),
        });
        logger.info(`Updated organization approval status in Realtime DB: ${id} - APPROVED`);
      } catch (rtdbError) {
        logger.error('Failed to update organization approval status in Realtime DB:', rtdbError);
      }
    }

    return organization;
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
    const membership = organizationDocToData(updated);

    await syncUserOrganizationRealtimeMembership({
      userId,
      organizationId,
      active: isMembershipActive(membership?.status || status),
    });

    await publishOrganizationRealtimeUpdate(organizationId, 'member-synced', {
      userId,
      role: membership?.role || normalizedRole,
      status: membership?.status || status,
    });
    await publishCandidateRealtimeUpdate(userId, 'organization-membership-updated', {
      organizationId,
      role: membership?.role || normalizedRole,
      status: membership?.status || status,
    });

    return membership;
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
    const createdAt = now();
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
      salaryCurrency: data.salaryCurrency || null,
      salaryMin: data.salaryMin || null,
      salaryMax: data.salaryMax || null,
      benefits: data.benefits || null,
      description: data.description || '',
      requirements: ensureArray(data.requirements),
      responsibilities: ensureArray(data.responsibilities),
      skills: ensureArray(data.skills),
      advertImageUrls: ensureArray(data.advertImageUrls).length > 0
        ? ensureArray(data.advertImageUrls)
        : (data.advertImageUrl ? [data.advertImageUrl] : []),
      advertImageUrl: data.advertImageUrl
        || ensureArray(data.advertImageUrls)[0]
        || null,
      advertImageAlt: data.advertImageAlt || null,
      advertVideoUrl: data.advertVideoUrl || null,
      status: sanitizeJobStatus(data.status),
      stages: ensureArray(data.stages),
      templateConfig: data.templateConfig || {
        interviewTypes: ['BEHAVIORAL'],
        duration: 30,
        scoringRubric: [],
      },
      reviewerIds: ensureArray(data.reviewerIds),
      hiringManagerId: data.hiringManagerId || null,
      postingDuration: data.postingDuration || 30,
      acceptingApplications: data.acceptingApplications !== false,
      scheduledPublishAt: data.scheduledPublishAt || null,
      publishedAt: null,
      expiresAt: null,
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      deletionMode: null,
      createdAt,
      updatedAt: createdAt,
    };
    
    // Handle publishing logic on creation
    if (payload.status === 'PUBLISHED') {
      if (data.scheduledPublishAt) {
        const scheduledDate = new Date(data.scheduledPublishAt);
        const nowDate = new Date();
        if (scheduledDate > nowDate) {
          // Scheduled for future - don't set publishedAt yet, keep status as PUBLISHED
          payload.publishedAt = null;
          payload.expiresAt = null;
        } else {
          // Scheduled time has passed or is now - publish immediately
          payload.publishedAt = data.publishedAt || now();
          const publishDate = new Date(payload.publishedAt);
          publishDate.setDate(publishDate.getDate() + payload.postingDuration);
          payload.expiresAt = publishDate.toISOString();
        }
      } else {
        // Publish immediately
        payload.publishedAt = data.publishedAt || now();
        const publishDate = new Date(payload.publishedAt);
        publishDate.setDate(publishDate.getDate() + payload.postingDuration);
        payload.expiresAt = publishDate.toISOString();
      }
    }

    await docRef.set(payload);
    return payload;
  },

  async update(id, data = {}) {
    const docRef = jobsCollection.doc(id);
    
    // Get existing job to check current status and postingDuration
    const existing = await this.getById(id, { includeDeleted: true });
    const postingDuration = data.postingDuration || existing?.postingDuration || 30;
    
    const payload = {
      ...data,
      ...(data.status ? { status: sanitizeJobStatus(data.status) } : {}),
      updatedAt: now(),
    };
    
    // Handle publishing logic
    if (data.status === 'PUBLISHED') {
      // If scheduledPublishAt is set and in the future, don't publish yet
      if (data.scheduledPublishAt) {
        const scheduledDate = new Date(data.scheduledPublishAt);
        const nowDate = new Date();
        if (scheduledDate > nowDate) {
          // Scheduled for future - don't set publishedAt yet
          payload.publishedAt = null;
          payload.expiresAt = null;
        } else {
          // Scheduled time has passed - publish now
          payload.publishedAt = data.publishedAt || now();
          const publishDate = new Date(payload.publishedAt);
          publishDate.setDate(publishDate.getDate() + postingDuration);
          payload.expiresAt = publishDate.toISOString();
        }
      } else {
        // Publish immediately
        payload.publishedAt = data.publishedAt || now();
        const publishDate = new Date(payload.publishedAt);
        publishDate.setDate(publishDate.getDate() + postingDuration);
        payload.expiresAt = publishDate.toISOString();
      }
    } else if (existing?.status === 'PUBLISHED' && data.status && data.status !== 'PUBLISHED') {
      // Only clear publish metadata when status is explicitly changed away from PUBLISHED.
      payload.publishedAt = null;
      payload.expiresAt = null;
    } else if (existing?.status === 'PUBLISHED' && !data.status) {
      // Updating published job - recalculate expiresAt if postingDuration changed
      if (data.postingDuration && existing.publishedAt) {
        const publishDate = new Date(existing.publishedAt);
        publishDate.setDate(publishDate.getDate() + postingDuration);
        payload.expiresAt = publishDate.toISOString();
      }
    }
    
    await docRef.set(payload, { merge: true });
    const updated = await docRef.get();
    return docToData(updated);
  },

  async getById(id, options = {}) {
    if (!id) return null;
    const includeDeleted = options?.includeDeleted === true;
    const doc = await jobsCollection.doc(id).get();
    const job = docToData(doc);
    if (!includeDeleted && isJobSoftDeleted(job)) return null;
    return job;
  },

  async listByOrganization(organizationId, options = {}) {
    if (!organizationId) return [];
    const includeDeleted = options?.includeDeleted === true;
    // Auto-publish any scheduled jobs before listing
    await this.autoPublishScheduledJobs();
    const snapshot = await jobsCollection.where('organizationId', '==', organizationId).orderBy('createdAt', 'desc').get();
    const jobs = snapshot.docs.map((doc) => docToData(doc));
    if (includeDeleted) return jobs;
    return jobs.filter((job) => !isJobSoftDeleted(job));
  },

  async listPublished(limit = 20) {
    // First, check and auto-publish any scheduled jobs whose time has come
    await this.autoPublishScheduledJobs();

    let jobs = [];
    try {
      const snapshot = await jobsCollection
        .where('status', '==', 'PUBLISHED')
        .orderBy('publishedAt', 'desc')
        .limit(limit * 2)
        .get();
      jobs = snapshot.docs.map((doc) => docToData(doc));
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }

      logger.warn('Published jobs index still building; falling back to in-memory sort.');
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);

      // Fallback query that only relies on single-field index.
      const snapshot = await jobsCollection
        .where('status', '==', 'PUBLISHED')
        .limit(limit * 5)
        .get();
      jobs = snapshot.docs
        .map((doc) => docToData(doc))
        .sort((a, b) => toMillis(b?.publishedAt) - toMillis(a?.publishedAt));
    }

    // Keep only currently public jobs (published, live, and not expired).
    const nowDate = new Date();
    const activeJobs = jobs.filter((job) => isJobCurrentlyPublic(job, nowDate));

    // Return limited results
    return activeJobs.slice(0, limit);
  },

  async autoPublishScheduledJobs() {
    try {
      const nowDate = new Date();
      const nowISO = nowDate.toISOString();
      
      // Query for jobs with scheduledPublishAt <= now (jobs ready to publish)
      // Note: This requires a Firestore index on scheduledPublishAt
      // If index doesn't exist, we'll catch the error and use fallback
      let scheduledJobsSnapshot;
      try {
        scheduledJobsSnapshot = await jobsCollection
          .where('scheduledPublishAt', '<=', nowISO)
          .limit(50)
          .get();
      } catch (indexError) {
        // If index doesn't exist, use fallback: get recent jobs and filter
        if (isIndexBuildingError(indexError)) {
          logger.warn('Scheduled jobs index not available, using fallback method');
          console.error('Firestore index error - click the link below to create the index:');
          console.error(indexError.message || indexError);
        }
        // Get recent jobs and filter in memory
        const allJobsSnapshot = await jobsCollection
          .orderBy('createdAt', 'desc')
          .limit(100)
          .get();
        scheduledJobsSnapshot = {
          docs: allJobsSnapshot.docs.filter((doc) => {
            const job = docToData(doc);
            if ((job?.status || '').toString().toUpperCase() !== 'PUBLISHED') return false;
            if (isJobSoftDeleted(job)) return false;
            if (!job?.scheduledPublishAt || job?.publishedAt) return false;
            const scheduledDate = new Date(job.scheduledPublishAt);
            if (Number.isNaN(scheduledDate.getTime())) return false;
            return scheduledDate <= nowDate;
          }),
        };
      }
      
      // Filter for jobs that haven't been published yet
      const jobsToPublish = scheduledJobsSnapshot.docs
        .map(docToData)
        .filter((job) => {
          if ((job?.status || '').toString().toUpperCase() !== 'PUBLISHED') return false;
          if (isJobSoftDeleted(job)) return false;
          if (!job.scheduledPublishAt) return false;
          const scheduledDate = new Date(job.scheduledPublishAt);
          if (Number.isNaN(scheduledDate.getTime())) return false;
          // Include jobs whose scheduled time has passed and haven't been published yet
          return scheduledDate <= nowDate && !job.publishedAt;
        });

      // Auto-publish each scheduled job
      for (const job of jobsToPublish) {
        const postingDuration = job.postingDuration || 30;
        const publishDate = now();
        const publishDateObj = new Date(publishDate);
        publishDateObj.setDate(publishDateObj.getDate() + postingDuration);
        const expiresAt = publishDateObj.toISOString();

        await jobsCollection.doc(job.id).set({
          status: 'PUBLISHED', // Ensure status is PUBLISHED
          publishedAt: publishDate,
          expiresAt,
          updatedAt: now(),
        }, { merge: true });

        await publishOrganizationRealtimeUpdate(job.organizationId, 'job-published', {
          jobId: job.id,
          status: 'PUBLISHED',
          publishedAt: publishDate,
        });
        await publishPublicRealtimeUpdate('jobs', 'job-published', {
          jobId: job.id,
          organizationId: job.organizationId || null,
          publishedAt: publishDate,
        });
        
        logger.info(`Auto-published scheduled job ${job.id} (${job.title})`);
      }

      return jobsToPublish.length;
    } catch (error) {
      logger.error('Error auto-publishing scheduled jobs:', error);
      return 0;
    }
  },

  async delete(id, options = {}) {
    if (!id) throw new Error('Job ID is required');
    const docRef = jobsCollection.doc(id);
    const hardDelete = options?.hardDelete === true;
    if (hardDelete) {
      await docRef.delete();
      return { id, deleted: true, hardDeleted: true };
    }

    const deletedAt = options?.deletedAt || now();
    await docRef.set({
      status: 'ARCHIVED',
      acceptingApplications: false,
      deletedAt,
      deletedBy: options?.deletedBy || null,
      deleteReason: options?.deleteReason || null,
      deletionMode: 'SOFT',
      updatedAt: deletedAt,
    }, { merge: true });
    const updated = await docRef.get();
    return { ...docToData(updated), deleted: true, hardDeleted: false };
  },
};

const buildInvitationPayload = (data = {}) => {
  const token = data.token || randomUUID();
  const acceptedAt = data.acceptedAt || null;
  const currentTime = now();
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
    acceptedAt,
    acceptanceInProgress: Boolean(data.acceptanceInProgress),
    acceptanceStartedAt: data.acceptanceStartedAt || null,
    acceptedInterviewId: data.acceptedInterviewId || null,
    acceptedApplicationId: data.acceptedApplicationId || null,
    createdAt: currentTime,
    updatedAt: currentTime,
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

  async update(id, data = {}) {
    if (!id) return null;
    await invitationsCollection.doc(id).set(
      { ...data, updatedAt: now() },
      { merge: true },
    );
    const updated = await invitationsCollection.doc(id).get();
    return docToData(updated);
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
      // Log the full error message which contains the index creation link
      // Firestore errors include a clickable link in the error message
      logger.warn('Invitation index still building; falling back to in-memory sort.');
      // Log the full error object so the link is visible in the terminal
      // The link is in error.message and will be clickable in most terminals
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);
      const snapshot = await invitationsCollection.where('organizationId', '==', organizationId).get();
      return snapshot.docs
        .map((doc) => docToData(doc))
        .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));
    }
  },

  async findActiveByJobAndEmail(organizationId, jobId, email) {
    if (!organizationId || !jobId || !email) return null;
    const normalizedEmail = String(email).trim().toLowerCase();
    try {
      const snapshot = await invitationsCollection
        .where('organizationId', '==', organizationId)
        .where('jobId', '==', jobId)
        .where('email', '==', normalizedEmail)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();
      const nowDate = new Date();
      const active = snapshot.docs
        .map((doc) => docToData(doc))
        .find((invitation) =>
          invitation?.status === 'PENDING'
          && (!invitation?.expiresAt || new Date(invitation.expiresAt) >= nowDate));
      return active || null;
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('Invitation lookup index missing or building; falling back to in-memory duplicate check.');
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);

      const snapshot = await invitationsCollection
        .where('organizationId', '==', organizationId)
        .where('jobId', '==', jobId)
        .where('email', '==', normalizedEmail)
        .get();
      const nowDate = new Date();
      const active = sortApplicationsByCreatedAtDesc(
        snapshot.docs.map((doc) => docToData(doc)),
      ).find((invitation) =>
        invitation?.status === 'PENDING'
        && (!invitation?.expiresAt || new Date(invitation.expiresAt) >= nowDate));
      return active || null;
    }
  },

  async markAccepted(token, userId) {
    const claim = await this.claimForAcceptance(token, userId);
    if (claim.status !== 'CLAIMED' && claim.status !== 'ALREADY_COMPLETED') {
      return null;
    }
    return claim.invitation;
  },

  async claimForAcceptance(token, userId) {
    if (!token || !userId) {
      return { status: 'NOT_FOUND', invitation: null };
    }

    const invitation = await this.getByToken(token);
    if (!invitation) {
      return { status: 'NOT_FOUND', invitation: null };
    }

    const docRef = invitationsCollection.doc(invitation.id);
    return firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      const current = docToData(snapshot);
      if (!current) {
        return { status: 'NOT_FOUND', invitation: null };
      }

      const currentTime = now();
      const claimEvaluation = evaluateInvitationAcceptanceClaim(current, userId, currentTime);
      if (claimEvaluation === INVITATION_ACCEPTANCE_CLAIM_STATUS.EXPIRED) {
        const expiredPayload = {
          status: 'EXPIRED',
          acceptanceInProgress: false,
          updatedAt: currentTime,
        };
        transaction.set(docRef, expiredPayload, { merge: true });
        return {
          status: 'EXPIRED',
          invitation: { ...current, ...expiredPayload },
        };
      }

      if (claimEvaluation === INVITATION_ACCEPTANCE_CLAIM_STATUS.ALREADY_COMPLETED) {
        return {
          status: 'ALREADY_COMPLETED',
          invitation: current,
        };
      }

      if (claimEvaluation === INVITATION_ACCEPTANCE_CLAIM_STATUS.IN_PROGRESS) {
        return {
          status: 'IN_PROGRESS',
          invitation: current,
        };
      }

      if (claimEvaluation !== INVITATION_ACCEPTANCE_CLAIM_STATUS.CLAIM_ALLOWED) {
        return {
          status: 'UNAVAILABLE',
          invitation: current,
        };
      }

      const acceptedAt = current.acceptedAt || currentTime;
      const acceptedPayload = {
        status: 'ACCEPTED',
        candidateUserId: userId,
        acceptedAt,
        acceptanceInProgress: true,
        acceptanceStartedAt: currentTime,
        updatedAt: currentTime,
      };
      transaction.set(docRef, acceptedPayload, { merge: true });

      return {
        status: 'CLAIMED',
        invitation: { ...current, ...acceptedPayload },
      };
    });
  },

  async finalizeAcceptance(invitationId, { interviewId = null, applicationId = null } = {}) {
    if (!invitationId) return null;
    await invitationsCollection.doc(invitationId).set(
      {
        status: 'ACCEPTED',
        acceptanceInProgress: false,
        acceptanceStartedAt: null,
        acceptedInterviewId: interviewId || null,
        acceptedApplicationId: applicationId || null,
        updatedAt: now(),
      },
      { merge: true },
    );
    const updated = await invitationsCollection.doc(invitationId).get();
    return docToData(updated);
  },

  async releaseAcceptanceLock(invitationId, options = {}) {
    if (!invitationId) return null;
    const revertToPending = options?.revertToPending === true;
    await invitationsCollection.doc(invitationId).set(
      {
        ...(revertToPending
          ? {
            status: 'PENDING',
            candidateUserId: null,
            acceptedAt: null,
          }
          : {}),
        acceptanceInProgress: false,
        acceptanceStartedAt: null,
        ...(revertToPending
          ? {
            acceptedInterviewId: null,
            acceptedApplicationId: null,
          }
          : {}),
        updatedAt: now(),
      },
      { merge: true },
    );
    const updated = await invitationsCollection.doc(invitationId).get();
    return docToData(updated);
  },
};

export const reviewStore = {
  async submit(interviewId, data = {}) {
    if (!interviewId) {
      throw new Error('interviewId is required');
    }
    const docRef = interviewReviewsCollection.doc();
    const score = data.score != null ? Number(data.score) : (data.rating != null ? Number(data.rating) * 10 : null);
    const decision = data.decision || data.recommendation || null;
    const payload = {
      id: docRef.id,
      interviewId,
      reviewerId: data.reviewerId,
      reviewerRole: data.reviewerRole || null,
      score: score != null ? Math.min(100, Math.max(0, score)) : null,
      decision: decision || null,
      strengths: ensureArray(data.strengths),
      weaknesses: ensureArray(data.weaknesses),
      notes: (data.notes != null && data.notes !== '') ? String(data.notes) : '',
      rating: data.rating != null ? Math.min(10, Math.max(0, Number(data.rating))) : null,
      technicalScore: data.technicalScore != null ? Math.min(10, Math.max(0, Number(data.technicalScore))) : null,
      communicationScore: data.communicationScore != null ? Math.min(10, Math.max(0, Number(data.communicationScore))) : null,
      problemSolvingScore: data.problemSolvingScore != null ? Math.min(10, Math.max(0, Number(data.problemSolvingScore))) : null,
      culturalFitScore: data.culturalFitScore != null ? Math.min(10, Math.max(0, Number(data.culturalFitScore))) : null,
      recommendation: data.recommendation || data.decision || null,
      aiOverallScoreAtReview: data.aiOverallScoreAtReview != null ? Number(data.aiOverallScoreAtReview) : null,
      smeOverallScore: data.smeOverallScore != null ? Number(data.smeOverallScore) : null,
      overrideOverall: Boolean(data.overrideOverall),
      createdAt: now(),
      updatedAt: now(),
    };
    await docRef.set(payload);
    return payload;
  },

  async getByInterviewAndReviewer(interviewId, reviewerId) {
    if (!interviewId || !reviewerId) return null;
    const reviews = await this.listByInterview(interviewId);
    return reviews.find((r) => r.reviewerId === reviewerId) || null;
  },

  async listByInterview(interviewId) {
    if (!interviewId) return [];
    const snapshot = await interviewReviewsCollection
      .where('interviewId', '==', interviewId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map((doc) => docToData(doc));
  },

  /**
   * List recent reviews (for admin calibration aggregation).
   */
  async listRecent(limit = 500) {
    const snapshot = await interviewReviewsCollection
      .orderBy('createdAt', 'desc')
      .limit(Math.min(limit, 500))
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

const normalizeApplicationPageLimit = (value, fallback = 50, max = 200) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
};

const normalizeApplicationCursor = (cursor) => {
  if (!cursor) return null;
  const normalized = String(cursor).trim();
  return normalized || null;
};

const sortApplicationsByCreatedAtDesc = (applications = []) =>
  applications
    .filter(Boolean)
    .sort((a, b) => {
      const createdAtDiff = toMillis(b?.createdAt) - toMillis(a?.createdAt);
      if (createdAtDiff !== 0) return createdAtDiff;
      return String(b?.id || '').localeCompare(String(a?.id || ''));
    });

const sliceApplicationsPage = (applications = [], limit = 50) => {
  const safeLimit = normalizeApplicationPageLimit(limit, 50, 200);
  const hasMore = applications.length > safeLimit;
  const items = applications.slice(0, safeLimit);
  const nextCursor = hasMore && items.length > 0 ? (items[items.length - 1]?.createdAt || null) : null;
  return {
    items,
    hasMore,
    nextCursor,
  };
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
      jobSnapshot: (data.jobSnapshot && typeof data.jobSnapshot === 'object') ? data.jobSnapshot : null,
      organizationSnapshot: (data.organizationSnapshot && typeof data.organizationSnapshot === 'object') ? data.organizationSnapshot : null,
      jobDeletedAt: data.jobDeletedAt || null,
      statusSource: data.statusSource || null,
      statusChangedAt: data.statusChangedAt || currentTime,
      dispositionCode: data.dispositionCode || null,
      dispositionCategory: data.dispositionCategory || null,
      dispositionReason: data.dispositionReason || null,
      dispositionNotes: data.dispositionNotes || null,
      dispositionTags: ensureArray(data.dispositionTags),
      dispositionAt: data.dispositionAt || null,
      dispositionBy: data.dispositionBy || null,
      statusHistory: ensureArray(data.statusHistory),
      submittedAt: data.submittedAt || currentTime,
      createdAt: currentTime,
      updatedAt: currentTime,
    };
    await docRef.set(payload);
    return payload;
  },

  /**
   * CRITICAL FIX: Atomic create with duplicate check to prevent race conditions (TOCTOU vulnerability)
   * This method uses a Firestore transaction to ensure duplicate check and create are atomic.
   */
  async createWithDuplicateCheck(data = {}) {
    const { jobId, candidateId } = data;
    if (!jobId || !candidateId) {
      throw new Error('jobId and candidateId are required');
    }

    // Use a transaction to ensure duplicate check and create are atomic
    return await db.runTransaction(async (transaction) => {
      // Check for existing application within transaction
      const existingQuery = jobApplicationsCollection
        .where('jobId', '==', jobId)
        .where('candidateId', '==', candidateId)
        .orderBy('createdAt', 'desc')
        .limit(1);
      
      const existingSnapshot = await transaction.get(existingQuery);
      
      if (!existingSnapshot.empty) {
        const existingApplication = docToData(existingSnapshot.docs[0]);
        
        // Allow re-applying if the previous application was withdrawn by the candidate
        const isWithdrawn = existingApplication.status === 'REJECTED' && existingApplication.withdrawnBy;
        
        if (!isWithdrawn) {
          // Throw error with existing application data
          const error = new Error('Duplicate application found');
          error.code = 'DUPLICATE_APPLICATION';
          error.existingApplication = existingApplication;
          throw error;
        }
        // If withdrawn, continue to create new application
      }

      // Create new application within transaction
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
        jobSnapshot: (data.jobSnapshot && typeof data.jobSnapshot === 'object') ? data.jobSnapshot : null,
        organizationSnapshot: (data.organizationSnapshot && typeof data.organizationSnapshot === 'object') ? data.organizationSnapshot : null,
        jobDeletedAt: data.jobDeletedAt || null,
        statusSource: data.statusSource || null,
        statusChangedAt: data.statusChangedAt || currentTime,
        dispositionCode: data.dispositionCode || null,
        dispositionCategory: data.dispositionCategory || null,
        dispositionReason: data.dispositionReason || null,
        dispositionNotes: data.dispositionNotes || null,
        dispositionTags: ensureArray(data.dispositionTags),
        dispositionAt: data.dispositionAt || null,
        dispositionBy: data.dispositionBy || null,
        statusHistory: ensureArray(data.statusHistory),
        submittedAt: data.submittedAt || currentTime,
        createdAt: currentTime,
        updatedAt: currentTime,
      };
      
      transaction.set(docRef, payload);
      return payload;
    });
  },

  async getById(id) {
    if (!id) return null;
    const doc = await jobApplicationsCollection.doc(id).get();
    return docToData(doc);
  },

  async checkDuplicate(jobId, candidateId) {
    if (!jobId || !candidateId) return null;
    try {
      const snapshot = await jobApplicationsCollection
        .where('jobId', '==', jobId)
        .where('candidateId', '==', candidateId)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      return docToData(snapshot.docs[0]);
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('Duplicate application index missing or still building; using fallback lookup.');
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);
      const snapshot = await jobApplicationsCollection
        .where('jobId', '==', jobId)
        .where('candidateId', '==', candidateId)
        .get();
      if (snapshot.empty) return null;
      const latest = sortApplicationsByCreatedAtDesc(snapshot.docs.map((doc) => docToData(doc)))[0];
      return latest || null;
    }
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
      logger.warn('Job application index missing or still building; falling back to in-memory sort.');
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);
      const snapshot = await jobApplicationsCollection.where('candidateId', '==', candidateId).get();
      return snapshot.docs
        .map((doc) => docToData(doc))
        .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));
    }
  },

  async listByCandidatePage(candidateId, options = {}) {
    if (!candidateId) return { items: [], hasMore: false, nextCursor: null };
    const status = options?.status ? String(options.status).trim().toUpperCase() : null;
    const cursor = normalizeApplicationCursor(options?.cursor);
    const limit = normalizeApplicationPageLimit(options?.limit, 50, 200);

    try {
      let query = jobApplicationsCollection
        .where('candidateId', '==', candidateId);
      if (status) {
        query = query.where('status', '==', status);
      }
      if (cursor) {
        query = query.where('createdAt', '<', cursor);
      }
      const snapshot = await query
        .orderBy('createdAt', 'desc')
        .limit(limit + 1)
        .get();
      return sliceApplicationsPage(snapshot.docs.map((doc) => docToData(doc)), limit);
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('Candidate applications page query index missing or building; using fallback pagination.');
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);

      const snapshot = await jobApplicationsCollection
        .where('candidateId', '==', candidateId)
        .get();
      let items = sortApplicationsByCreatedAtDesc(snapshot.docs.map((doc) => docToData(doc)));
      if (status) {
        items = items.filter((app) => String(app?.status || '').toUpperCase() === status);
      }
      if (cursor) {
        const cursorMillis = toMillis(cursor);
        items = items.filter((app) => toMillis(app?.createdAt) < cursorMillis);
      }
      return sliceApplicationsPage(items, limit);
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
      logger.warn('Job application index missing or still building; falling back to in-memory sort.');
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);
      const snapshot = await jobApplicationsCollection.where('jobId', '==', jobId).get();
      return snapshot.docs
        .map((doc) => docToData(doc))
        .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));
    }
  },

  async listByJobPage(jobId, options = {}) {
    if (!jobId) return { items: [], hasMore: false, nextCursor: null };
    const status = options?.status ? String(options.status).trim().toUpperCase() : null;
    const cursor = normalizeApplicationCursor(options?.cursor);
    const limit = normalizeApplicationPageLimit(options?.limit, 50, 200);

    try {
      let query = jobApplicationsCollection
        .where('jobId', '==', jobId);
      if (status) {
        query = query.where('status', '==', status);
      }
      if (cursor) {
        query = query.where('createdAt', '<', cursor);
      }
      const snapshot = await query
        .orderBy('createdAt', 'desc')
        .limit(limit + 1)
        .get();
      return sliceApplicationsPage(snapshot.docs.map((doc) => docToData(doc)), limit);
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('Job applications page query index missing or building; using fallback pagination.');
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);

      const snapshot = await jobApplicationsCollection
        .where('jobId', '==', jobId)
        .get();
      let items = sortApplicationsByCreatedAtDesc(snapshot.docs.map((doc) => docToData(doc)));
      if (status) {
        items = items.filter((app) => String(app?.status || '').toUpperCase() === status);
      }
      if (cursor) {
        const cursorMillis = toMillis(cursor);
        items = items.filter((app) => toMillis(app?.createdAt) < cursorMillis);
      }
      return sliceApplicationsPage(items, limit);
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
      logger.warn('Job application index missing or still building; falling back to in-memory sort.');
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);
      const snapshot = await jobApplicationsCollection
        .where('organizationId', '==', organizationId)
        .get();
      return snapshot.docs
        .map((doc) => docToData(doc))
        .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt))
        .slice(0, limit);
    }
  },

  async listByOrganizationPage(organizationId, options = {}) {
    if (!organizationId) return { items: [], hasMore: false, nextCursor: null };
    const status = options?.status ? String(options.status).trim().toUpperCase() : null;
    const cursor = normalizeApplicationCursor(options?.cursor);
    const limit = normalizeApplicationPageLimit(options?.limit, 50, 200);

    try {
      let query = jobApplicationsCollection
        .where('organizationId', '==', organizationId);
      if (status) {
        query = query.where('status', '==', status);
      }
      if (cursor) {
        query = query.where('createdAt', '<', cursor);
      }
      const snapshot = await query
        .orderBy('createdAt', 'desc')
        .limit(limit + 1)
        .get();
      return sliceApplicationsPage(snapshot.docs.map((doc) => docToData(doc)), limit);
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('Organization applications page query index missing or building; using fallback pagination.');
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);

      const snapshot = await jobApplicationsCollection
        .where('organizationId', '==', organizationId)
        .get();
      let items = sortApplicationsByCreatedAtDesc(snapshot.docs.map((doc) => docToData(doc)));
      if (status) {
        items = items.filter((app) => String(app?.status || '').toUpperCase() === status);
      }
      if (cursor) {
        const cursorMillis = toMillis(cursor);
        items = items.filter((app) => toMillis(app?.createdAt) < cursorMillis);
      }
      return sliceApplicationsPage(items, limit);
    }
  },

  async countByJob(jobId) {
    if (!jobId) return 0;
    try {
      const snapshot = await jobApplicationsCollection
        .where('jobId', '==', jobId)
        .get();
      return snapshot.size;
    } catch (error) {
      logger.error('Failed to count applications by job:', error);
      return 0;
    }
  },

  async countByJobIds(jobIds = []) {
    const uniqueJobIds = Array.from(new Set((jobIds || []).filter(Boolean)));
    const counts = new Map(uniqueJobIds.map((jobId) => [jobId, 0]));
    if (uniqueJobIds.length === 0) {
      return counts;
    }

    const chunkSize = 10;
    const chunks = [];
    for (let i = 0; i < uniqueJobIds.length; i += chunkSize) {
      chunks.push(uniqueJobIds.slice(i, i + chunkSize));
    }

    try {
      const snapshots = await Promise.all(
        chunks.map((chunk) =>
          jobApplicationsCollection
            .where('jobId', 'in', chunk)
            .get()),
      );
      snapshots.forEach((snapshot) => {
        snapshot.docs.forEach((doc) => {
          const jobId = doc.data()?.jobId;
          if (!jobId) return;
          counts.set(jobId, (counts.get(jobId) || 0) + 1);
        });
      });
      return counts;
    } catch (error) {
      logger.warn('Batch job application count query failed; falling back to per-job counts.', error);
      await Promise.all(
        uniqueJobIds.map(async (jobId) => {
          const count = await this.countByJob(jobId);
          counts.set(jobId, count);
        }),
      );
      return counts;
    }
  },

  async update(id, updates) {
    if (!id) throw new Error('Application ID is required');
    const updateData = {
      ...updates,
      ...(Object.prototype.hasOwnProperty.call(updates || {}, 'dispositionTags')
        ? { dispositionTags: ensureArray(updates.dispositionTags) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(updates || {}, 'statusHistory')
        ? { statusHistory: ensureArray(updates.statusHistory) }
        : {}),
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

  async listPage(options = {}) {
    const limit = normalizeAuditPageLimit(options?.limit, 100, 500);
    const cursor = decodeAuditCursor(options?.cursor);
    const cursorCreatedAt = cursor?.createdAt || null;

    try {
      let query = platformAuditLogsCollection;
      if (cursorCreatedAt) {
        query = query.where('createdAt', '<', cursorCreatedAt);
      }
      const snapshot = await query
        .orderBy('createdAt', 'desc')
        .limit(limit + 1)
        .get();
      return sliceAuditLogsPage(snapshot.docs.map((doc) => docToData(doc)), limit);
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('Platform audit log index still building; falling back to in-memory sort.');
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);
      const snapshot = await platformAuditLogsCollection.get();
      let logs = sortAuditLogsByCreatedAtDesc(snapshot.docs.map((doc) => docToData(doc)));
      if (cursorCreatedAt) {
        const cursorMillis = toMillis(cursorCreatedAt);
        logs = logs.filter((log) => toMillis(log?.createdAt) < cursorMillis);
      }
      return sliceAuditLogsPage(logs, limit);
    }
  },

  async listPageFromOffset(options = {}) {
    const limit = normalizeAuditPageLimit(options?.limit, 100, 500);
    let remainingOffset = Number.parseInt(options?.offset, 10);
    if (!Number.isInteger(remainingOffset) || remainingOffset <= 0) {
      return this.listPage({ limit });
    }

    let cursor = null;
    while (remainingOffset > 0) {
      const skipLimit = Math.min(remainingOffset, 500);
      const skippedPage = await this.listPage({ limit: skipLimit, cursor });
      if (skippedPage.items.length === 0) {
        return { items: [], hasMore: false, nextCursor: null };
      }
      remainingOffset -= skippedPage.items.length;
      cursor = skippedPage.nextCursor;
      if (!cursor && remainingOffset > 0) {
        return { items: [], hasMore: false, nextCursor: null };
      }
    }

    return this.listPage({ limit, cursor });
  },

  async list(limit = 100, offset = 0) {
    const page = await this.listPageFromOffset({ limit, offset });
    return page.items;
  },
};

const SYSTEM_FEATURE_FLAG_DEFAULTS = Object.freeze({
  enableJobPosting: true,
  enableInvitations: true,
  enableReviews: true,
  enableAnalytics: true,
});

const SYSTEM_DEFAULT_AI_CONFIG = Object.freeze({
  model: 'qwen3:8b',
  temperature: 0.7,
  maxTokens: 2000,
});

const SYSTEM_DATA_RETENTION_DEFAULTS = Object.freeze({
  interviewDataDays: 365,
  activityLogDays: 90,
});

const SYSTEM_DATA_RETENTION_LIMITS = Object.freeze({
  interviewDataDays: Object.freeze({ min: 30, max: 3650 }),
  activityLogDays: Object.freeze({ min: 7, max: 3650 }),
});

const clampNumericSetting = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const normalizeFeatureFlags = (featureFlags = {}) => ({
  ...SYSTEM_FEATURE_FLAG_DEFAULTS,
  ...(featureFlags && typeof featureFlags === 'object' ? featureFlags : {}),
});

const normalizeDefaultAIConfig = (config = {}) => {
  const source = config && typeof config === 'object' ? config : {};
  return {
    model: typeof source.model === 'string' && source.model.trim()
      ? source.model.trim()
      : SYSTEM_DEFAULT_AI_CONFIG.model,
    temperature: clampNumericSetting(
      source.temperature,
      SYSTEM_DEFAULT_AI_CONFIG.temperature,
      0,
      1,
    ),
    maxTokens: Math.round(clampNumericSetting(
      source.maxTokens,
      SYSTEM_DEFAULT_AI_CONFIG.maxTokens,
      256,
      32768,
    )),
  };
};

const normalizeDataRetention = (dataRetention = {}) => {
  const source = dataRetention && typeof dataRetention === 'object' ? dataRetention : {};
  return {
    interviewDataDays: Math.round(clampNumericSetting(
      source.interviewDataDays,
      SYSTEM_DATA_RETENTION_DEFAULTS.interviewDataDays,
      SYSTEM_DATA_RETENTION_LIMITS.interviewDataDays.min,
      SYSTEM_DATA_RETENTION_LIMITS.interviewDataDays.max,
    )),
    activityLogDays: Math.round(clampNumericSetting(
      source.activityLogDays,
      SYSTEM_DATA_RETENTION_DEFAULTS.activityLogDays,
      SYSTEM_DATA_RETENTION_LIMITS.activityLogDays.min,
      SYSTEM_DATA_RETENTION_LIMITS.activityLogDays.max,
    )),
  };
};

const normalizeSystemSettings = (settings = {}) => {
  const source = settings && typeof settings === 'object' ? settings : {};
  return {
    ...source,
    id: 'main',
    featureFlags: normalizeFeatureFlags(source.featureFlags),
    maintenanceMode: Boolean(source.maintenanceMode),
    nonverbalFeedbackEnabled: source.nonverbalFeedbackEnabled !== false,
    defaultAIConfig: normalizeDefaultAIConfig(source.defaultAIConfig),
    dataRetention: normalizeDataRetention(source.dataRetention),
  };
};

const createDefaultSystemSettings = (adminId = null) => ({
  id: 'main',
  featureFlags: normalizeFeatureFlags(),
  maintenanceMode: false,
  nonverbalFeedbackEnabled: true,
  defaultAIConfig: normalizeDefaultAIConfig(),
  dataRetention: normalizeDataRetention(),
  createdAt: now(),
  updatedAt: now(),
  initializedBy: adminId || null,
});

export const systemSettingsStore = {
  async initialize(adminId) {
    const settingsDoc = await systemSettingsCollection.doc('main').get();
    if (settingsDoc.exists) {
      return normalizeSystemSettings(docToData(settingsDoc));
    }

    const defaultSettings = createDefaultSystemSettings(adminId);

    await systemSettingsCollection.doc('main').set(defaultSettings);
    await syncPublicSystemSettings(defaultSettings);
    return defaultSettings;
  },

  async get() {
    const doc = await systemSettingsCollection.doc('main').get();
    if (!doc.exists) {
      return normalizeSystemSettings(createDefaultSystemSettings());
    }
    return normalizeSystemSettings(docToData(doc));
  },

  async update(updates, updatedBy) {
    const current = await this.get();
    const merged = normalizeSystemSettings({
      ...current,
      ...(updates && typeof updates === 'object' ? updates : {}),
    });
    const persisted = {
      ...merged,
      createdAt: current.createdAt || now(),
      updatedAt: now(),
      updatedBy: updatedBy || current.updatedBy || null,
      initializedBy: current.initializedBy || null,
    };

    await systemSettingsCollection.doc('main').set(persisted, { merge: true });
    await syncPublicSystemSettings(persisted);
    return persisted;
  },
};

export const emailVerificationStore = {
  async getByUid(uid) {
    if (!uid) return null;
    const doc = await emailVerificationsCollection.doc(uid).get();
    return docToData(doc);
  },

  async upsert(uid, data = {}) {
    if (!uid) {
      throw new Error('uid is required for email verification records');
    }
    const existingDoc = await emailVerificationsCollection.doc(uid).get();
    const existing = existingDoc.exists ? existingDoc.data() : null;
    const payload = {
      id: uid,
      uid,
      ...data,
      updatedAt: now(),
      createdAt: data.createdAt || existing?.createdAt || now(),
    };
    await emailVerificationsCollection.doc(uid).set(payload, { merge: true });
    const doc = await emailVerificationsCollection.doc(uid).get();
    return docToData(doc);
  },

  async delete(uid) {
    if (!uid) return false;
    await emailVerificationsCollection.doc(uid).delete();
    return true;
  },
};

/**
 * Team Invitation Store
 * Handles invitations for team members (RECRUITER/REVIEWER) to join an organization
 */
export const teamInvitationStore = {
  /**
   * Create a team invitation
   */
  async create({ organizationId, email, role, invitedBy }) {
    if (!organizationId || !email || !role) {
      throw new Error('organizationId, email, and role are required');
    }

    const normalizedRole = sanitizeOrgRole(role) || 'RECRUITER';
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const invitation = {
      organizationId,
      email: email.toLowerCase().trim(),
      role: normalizedRole,
      token,
      status: 'PENDING',
      invitedBy,
      invitedAt: now(),
      expiresAt,
      acceptedAt: null,
      acceptedBy: null,
    };

    const docRef = await teamInvitationsCollection.add(invitation);
    const doc = await docRef.get();
    return docToData(doc);
  },

  /**
   * Get invitation by token
   */
  async getByToken(token) {
    if (!token) return null;
    const snapshot = await teamInvitationsCollection
      .where('token', '==', token)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    return docToData(snapshot.docs[0]);
  },

  /**
   * Get invitation by ID
   */
  async getById(id) {
    if (!id) return null;
    const doc = await teamInvitationsCollection.doc(id).get();
    return docToData(doc);
  },

  /**
   * List invitations for an organization
   */
  async listByOrganization(organizationId, status = null) {
    if (!organizationId) return [];
    
    let query = teamInvitationsCollection.where('organizationId', '==', organizationId);
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    const snapshot = await query.orderBy('invitedAt', 'desc').get();
    return snapshot.docs.map(docToData);
  },

  /**
   * Check if invitation exists for email in organization
   */
  async findPendingByEmail(organizationId, email) {
    if (!organizationId || !email) return null;
    
    const snapshot = await teamInvitationsCollection
      .where('organizationId', '==', organizationId)
      .where('email', '==', email.toLowerCase().trim())
      .where('status', '==', 'PENDING')
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    return docToData(snapshot.docs[0]);
  },

  /**
   * Mark invitation as accepted
   */
  async markAccepted(id, userId) {
    if (!id) throw new Error('Invitation ID is required');
    
    const docRef = teamInvitationsCollection.doc(id);
    await docRef.update({
      status: 'ACCEPTED',
      acceptedBy: userId,
      acceptedAt: now(),
      updatedAt: now(),
    });
    
    const updated = await docRef.get();
    return docToData(updated);
  },

  /**
   * Revoke invitation
   */
  async revoke(id) {
    if (!id) throw new Error('Invitation ID is required');
    
    const docRef = teamInvitationsCollection.doc(id);
    await docRef.update({
      status: 'REVOKED',
      updatedAt: now(),
    });
    
    const updated = await docRef.get();
    return docToData(updated);
  },

  /**
   * Check if invitation is valid (not expired, not accepted, not revoked)
   */
  isValid(invitation) {
    if (!invitation) return false;
    if (invitation.status !== 'PENDING') return false;
    
    const expiresAt = new Date(invitation.expiresAt);
    return expiresAt > new Date();
  },

  /**
   * Delete invitation
   */
  async delete(id) {
    if (!id) throw new Error('Invitation ID is required');
    await teamInvitationsCollection.doc(id).delete();
    return { success: true };
  },
};

// ============================================================================
// GAP FEATURE: Personal Answer Library
// ============================================================================

export const savedAnswerStore = {
  /**
   * Save an answer to the personal library
   */
  async create(data = {}) {
    const docRef = savedAnswersCollection.doc();
    const currentTime = now();
    const payload = {
      id: docRef.id,
      userId: data.userId,
      questionText: data.questionText || '',
      answer: data.answer || '',
      interviewId: data.interviewId || null,
      questionId: data.questionId || null,
      notes: data.notes || '',
      tags: ensureArray(data.tags),
      rating: data.rating || null,
      savedAt: currentTime,
      createdAt: currentTime,
      updatedAt: currentTime,
    };
    await docRef.set(payload);
    return payload;
  },

  /**
   * Get saved answers for a user
   */
  async listByUser(userId, options = {}) {
    if (!userId) return [];
    const limit = options.limit || 100;
    const tag = options.tag;

    try {
      let query = savedAnswersCollection
        .where('userId', '==', userId)
        .orderBy('savedAt', 'desc');
      
      if (limit) {
        query = query.limit(limit);
      }

      const snapshot = await query.get();
      let answers = snapshot.docs.map((doc) => docToData(doc));

      // Filter by tag if provided (in-memory since Firestore array-contains requires index)
      if (tag) {
        answers = answers.filter((a) => a.tags && a.tags.includes(tag));
      }

      return answers;
    } catch (error) {
      if (!isIndexBuildingError(error)) {
        throw error;
      }
      logger.warn('SavedAnswers index still building; falling back to in-memory sort.');
      const snapshot = await savedAnswersCollection.where('userId', '==', userId).get();
      let answers = snapshot.docs
        .map((doc) => docToData(doc))
        .sort((a, b) => toMillis(b?.savedAt) - toMillis(a?.savedAt));
      
      if (tag) {
        answers = answers.filter((a) => a.tags && a.tags.includes(tag));
      }

      if (limit) {
        answers = answers.slice(0, limit);
      }
      return answers;
    }
  },

  /**
   * Update saved answer
   */
  async update(id, updates = {}) {
    if (!id) throw new Error('Saved answer ID is required');
    const docRef = savedAnswersCollection.doc(id);
    const payload = {
      ...updates,
      updatedAt: now(),
    };
    await docRef.update(payload);
    const updated = await docRef.get();
    return docToData(updated);
  },

  /**
   * Delete saved answer
   */
  async delete(id) {
    if (!id) throw new Error('Saved answer ID is required');
    await savedAnswersCollection.doc(id).delete();
    return { success: true };
  },

  /**
   * Get saved answer by ID
   */
  async getById(id) {
    if (!id) return null;
    const doc = await savedAnswersCollection.doc(id).get();
    return docToData(doc);
  },
};

// ============================================================================
// GAP FEATURE: Practice Streak Tracking
// ============================================================================

/**
 * Calculate practice streak for a candidate
 */
export function calculatePracticeStreak(lastPracticeDate, newPracticeDate) {
  if (!lastPracticeDate) {
    return { currentStreak: 1, shouldReset: false };
  }

  const lastDate = new Date(lastPracticeDate);
  const newDate = new Date(newPracticeDate);
  
  // Normalize to start of day for comparison
  lastDate.setHours(0, 0, 0, 0);
  newDate.setHours(0, 0, 0, 0);
  
  const diffInMs = newDate - lastDate;
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
  
  if (diffInDays === 0) {
    // Same day - no change to streak
    return { currentStreak: null, shouldReset: false, sameDay: true };
  } else if (diffInDays === 1) {
    // Consecutive day - increment streak
    return { currentStreak: null, shouldReset: false, increment: true };
  } else {
    // Gap > 1 day - reset streak
    return { currentStreak: 1, shouldReset: true };
  }
}

/**
 * Update practice streak when interview is completed
 */
export async function updatePracticeStreak(userId, interviewCompletedAt) {
  try {
    const user = await userStore.getByUid(userId);
    if (!user || user.accountType !== 'CANDIDATE') {
      return;
    }

    const completedDate = new Date(interviewCompletedAt).toISOString().split('T')[0]; // YYYY-MM-DD
    const lastPracticeDate = user.profile?.practiceStats?.lastPracticeDate;
    
    const streakCalc = calculatePracticeStreak(lastPracticeDate, completedDate);
    
    if (streakCalc.sameDay) {
      // Same day - just increment session count, no streak change
      const practiceHistory = user.profile?.practiceStats?.practiceHistory || {};
      const todayStats = practiceHistory[completedDate] || { sessionsCompleted: 0, questionsAnswered: 0, averageScore: 0 };
      
      await usersCollection.doc(userId).set({
        profile: {
          practiceStats: {
            lastPracticeDate: completedDate,
            totalPracticeSessions: (user.profile?.practiceStats?.totalPracticeSessions || 0) + 1,
            practiceHistory: {
              ...practiceHistory,
              [completedDate]: {
                sessionsCompleted: todayStats.sessionsCompleted + 1,
                questionsAnswered: todayStats.questionsAnswered,
                averageScore: todayStats.averageScore,
              },
            },
          },
        },
      }, { merge: true });
      return;
    }

    let newCurrentStreak;
    if (streakCalc.shouldReset) {
      newCurrentStreak = 1;
    } else if (streakCalc.increment) {
      newCurrentStreak = (user.profile?.practiceStats?.currentStreak || 0) + 1;
    } else {
      newCurrentStreak = user.profile?.practiceStats?.currentStreak || 1;
    }

    const longestStreak = Math.max(
      newCurrentStreak,
      user.profile?.practiceStats?.longestStreak || 0
    );

    const practiceHistory = user.profile?.practiceStats?.practiceHistory || {};
    const todayStats = practiceHistory[completedDate] || { sessionsCompleted: 0, questionsAnswered: 0, averageScore: 0 };

    await usersCollection.doc(userId).set({
      profile: {
        practiceStats: {
          currentStreak: newCurrentStreak,
          longestStreak,
          lastPracticeDate: completedDate,
          totalPracticeSessions: (user.profile?.practiceStats?.totalPracticeSessions || 0) + 1,
          practiceHistory: {
            ...practiceHistory,
            [completedDate]: {
              sessionsCompleted: todayStats.sessionsCompleted + 1,
              questionsAnswered: todayStats.questionsAnswered,
              averageScore: todayStats.averageScore,
            },
          },
        },
      },
    }, { merge: true });

    logger.info(`Practice streak updated for user ${userId}: ${newCurrentStreak} days`);
  } catch (error) {
    logger.error('Update practice streak error:', error);
    // Non-fatal - don't block interview completion
  }
}
