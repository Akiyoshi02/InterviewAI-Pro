import { randomUUID } from 'crypto';
import { firestore, realtimeDb } from '../config/firebase.js';
import logger from '../utils/logger.js';

const usersCollection = firestore.collection('users');
const interviewsCollection = firestore.collection('interviews');
const webrtcCollection = firestore.collection('webrtcSessions');

const QUESTION_TYPES = new Set(['BEHAVIORAL', 'TECHNICAL', 'CODING', 'SYSTEM_DESIGN']);
const DIFFICULTY_LEVELS = new Set(['EASY', 'MEDIUM', 'HARD']);

const now = () => new Date().toISOString();

const docToData = (doc) => {
  if (!doc || !doc.exists) {
    return null;
  }
  return { id: doc.id, ...doc.data() };
};

const buildUserSummary = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || null,
    fullName: user.fullName || null,
    accountType: user.accountType || null,
    companyName: user.companyName || null,
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

