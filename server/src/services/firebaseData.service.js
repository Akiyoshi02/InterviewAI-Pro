import { randomUUID } from 'crypto';
import { firestore, realtimeDb } from '../config/firebase.js';
import logger from '../utils/logger.js';

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
  if ((job.status || '').toString().toUpperCase() !== 'PUBLISHED') return false;

  const nowMillis = toMillis(nowValue) || Date.now();
  const publishedAtMillis = toMillis(job.publishedAt);

  // Scheduled jobs stay non-public until publishedAt is set by the scheduler.
  if (!publishedAtMillis || publishedAtMillis > nowMillis) return false;

  const expiresAtMillis = getJobExpiryMillis(job);
  if (!expiresAtMillis) return false;

  return expiresAtMillis > nowMillis;
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

  const timestamp = now();
  const event = {
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
    
    const completedInterviews = interviews.filter(i => i?.status === 'COMPLETED');
    const scheduledInterviews = interviews.filter(i => i?.status === 'SCHEDULED');
    const inProgressInterviews = interviews.filter(i => i?.status === 'IN_PROGRESS');
    
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
        // Additional metrics without comparison
        totalInterviews: currentMetrics.totalInterviews,
        inProgressInterviews: currentMetrics.inProgressInterviews,
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
        totalInterviews: current.totalInterviews,
        inProgressInterviews: current.inProgressInterviews,
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
      advertImageUrl: data.advertImageUrl || null,
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
      scheduledPublishAt: data.scheduledPublishAt || null,
      publishedAt: null,
      expiresAt: null,
      createdAt: now(),
      updatedAt: now(),
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
    const existing = await this.getById(id);
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

  async getById(id) {
    if (!id) return null;
    const doc = await jobsCollection.doc(id).get();
    return docToData(doc);
  },

  async listByOrganization(organizationId) {
    if (!organizationId) return [];
    // Auto-publish any scheduled jobs before listing
    await this.autoPublishScheduledJobs();
    const snapshot = await jobsCollection.where('organizationId', '==', organizationId).orderBy('createdAt', 'desc').get();
    return snapshot.docs.map((doc) => docToData(doc));
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
      logger.warn('Job application index missing or still building; falling back to in-memory sort.');
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);
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
      logger.warn('Job application index missing or still building; falling back to in-memory sort.');
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);
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
      console.error('Firestore index error - click the link below to create the index:');
      console.error(error.message || error);
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
      nonverbalFeedbackEnabled: true,
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
    await syncPublicSystemSettings(defaultSettings);
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
        nonverbalFeedbackEnabled: true,
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
    await syncPublicSystemSettings(merged);
    return merged;
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
