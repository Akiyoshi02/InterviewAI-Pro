import { LLMService } from '../services/llm.service.js';
import {
  hydrateInterviewParticipants,
  interviewStore,
  jobApplicationStore,
  jobStore,
  publishAdminRealtimeUpdate,
  publishOrganizationRealtimeUpdate,
  recordRealtimeEvent,
  systemSettingsStore,
  userStore,
} from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';

const ensureAccess = (interview, user, { allowOrganizationMembers = true } = {}) => {
  if (!interview) {
    return { allowed: false, status: 404, message: 'Interview not found' };
  }

  const normalizedUserId = typeof user === 'string' ? user : user?.id;
  const viewerAccountType = user?.accountType || null;
  const viewerOrganizationId = user?.organizationContext?.organization?.id || null;

  const isDirectParticipant = interview.candidateId === normalizedUserId || interview.companyId === normalizedUserId;
  if (isDirectParticipant) {
    return { allowed: true };
  }

  const isOrganizationMember = allowOrganizationMembers
    && viewerAccountType === 'COMPANY'
    && Boolean(viewerOrganizationId)
    && interview.organizationId === viewerOrganizationId;

  if (!isOrganizationMember) {
    return { allowed: false, status: 403, message: 'Access denied' };
  }

  return { allowed: true };
};

const canCreateHiringInterview = (role) => {
  const normalizedRole = String(role || '').toUpperCase();
  return normalizedRole === 'ADMIN' || normalizedRole === 'RECRUITER';
};

const attachSingleInterviewParticipants = async (interview) => {
  if (!interview) return null;
  const participantMap = await userStore.getSummaries([interview.candidateId, interview.companyId].filter(Boolean));

  return {
    ...interview,
    candidate: interview.candidateId ? participantMap.get(interview.candidateId) || null : null,
    company: interview.companyId ? participantMap.get(interview.companyId) || null : null,
  };
};

const isTerminalInterviewStatus = (status) => {
  const normalized = String(status || '').toUpperCase();
  return normalized === 'COMPLETED' || normalized === 'CANCELLED';
};

const DEFAULT_SYSTEM_AI_CONFIG = Object.freeze({
  model: process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct',
  temperature: 0.7,
  maxTokens: 2000,
});

const clampNumber = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const normalizeAiConfig = (value, fallback = DEFAULT_SYSTEM_AI_CONFIG) => {
  const source = value && typeof value === 'object' ? value : {};
  return {
    model: typeof source.model === 'string' && source.model.trim()
      ? source.model.trim()
      : fallback.model,
    temperature: clampNumber(source.temperature, fallback.temperature, 0, 1),
    maxTokens: Math.round(clampNumber(source.maxTokens, fallback.maxTokens, 256, 32768)),
  };
};

const mergeInterviewConfigWithSystemDefaults = (rawConfig, systemDefaultAIConfig) => {
  const sourceConfig = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  const advancedSettings =
    sourceConfig.advancedSettings && typeof sourceConfig.advancedSettings === 'object'
      ? sourceConfig.advancedSettings
      : {};

  const baselineAiConfig = normalizeAiConfig(systemDefaultAIConfig || DEFAULT_SYSTEM_AI_CONFIG);
  const mergedAiConfig = normalizeAiConfig(
    sourceConfig.aiConfig || advancedSettings.aiConfig || {
      model: advancedSettings.model,
      temperature: advancedSettings.temperature,
      maxTokens: advancedSettings.maxTokens,
    },
    baselineAiConfig,
  );

  return {
    ...sourceConfig,
    aiConfig: mergedAiConfig,
    advancedSettings: {
      ...advancedSettings,
      aiConfig: mergedAiConfig,
    },
    systemDefaultAIConfig: baselineAiConfig,
  };
};

const resolveInterviewLlmOptions = (interviewConfig) => {
  const config = interviewConfig && typeof interviewConfig === 'object' ? interviewConfig : {};
  const advancedSettings =
    config.advancedSettings && typeof config.advancedSettings === 'object'
      ? config.advancedSettings
      : {};
  return normalizeAiConfig(
    config.aiConfig || advancedSettings.aiConfig || {
      model: advancedSettings.model,
      temperature: advancedSettings.temperature,
      maxTokens: advancedSettings.maxTokens,
    },
  );
};

export class InterviewController {
  static async createInterview(req, res, next) {
    try {
      const {
        mode,
        jobRole,
        experienceLevel,
        industry,
        interviewTypes,
        skillFocus,
        duration,
        jobId,
        jobStage,
        invitationId,
        config,
        candidateId,
        status,
        pipelineStatus,
        reviewerAssignments,
      } = req.body;
      const userId = req.user.id;
      const accountType = req.user.accountType;
      const organizationContext = req.user.organizationContext || null;
      const organizationId = organizationContext?.organization?.id || null;
      const organizationStatus = String(organizationContext?.organization?.status || '').toUpperCase();
      const organizationRole = String(organizationContext?.membership?.role || '').toUpperCase();
      const normalizedMode = String(mode || '').toUpperCase();
      const normalizedCandidateId = typeof candidateId === 'string' ? candidateId.trim() : null;
      let systemSettings = null;

      if (normalizedMode === 'PRACTICE' && accountType !== 'CANDIDATE') {
        return res.status(403).json({ error: 'Only candidates can create practice interviews' });
      }

      if (normalizedMode === 'HIRING' && accountType !== 'COMPANY') {
        return res.status(403).json({ error: 'Only companies can create hiring interviews' });
      }

      if (normalizedMode === 'HIRING' && !organizationId) {
        return res.status(400).json({ error: 'Organization context required for hiring interviews' });
      }

      if (normalizedMode === 'HIRING' && organizationStatus !== 'APPROVED') {
        return res.status(403).json({
          error: 'Organization approval is required to create hiring interviews',
          code: 'ORG_APPROVAL_REQUIRED',
        });
      }

      if (normalizedMode === 'HIRING' && !canCreateHiringInterview(organizationRole)) {
        return res.status(403).json({
          error: 'Insufficient organization permissions to create hiring interviews',
          code: 'INSUFFICIENT_ORG_PERMISSIONS',
        });
      }

      if (normalizedMode === 'HIRING' && !normalizedCandidateId) {
        return res.status(400).json({
          error: 'candidateId is required for hiring interviews',
          code: 'HIRING_CANDIDATE_REQUIRED',
        });
      }

      let mergedInterviewConfig = null;
      if (config || normalizedMode === 'PRACTICE' || normalizedMode === 'HIRING') {
        try {
          systemSettings = await systemSettingsStore.get();
          mergedInterviewConfig = mergeInterviewConfigWithSystemDefaults(
            config,
            systemSettings?.defaultAIConfig,
          );
        } catch (settingsError) {
          logger.warn('Failed to load system AI defaults; using fallback defaults.', settingsError);
          mergedInterviewConfig = mergeInterviewConfigWithSystemDefaults(config, DEFAULT_SYSTEM_AI_CONFIG);
        }
      }

      if (normalizedMode === 'HIRING') {
        const featureFlags = systemSettings?.featureFlags || {};
        if (featureFlags.enableInvitations === false || featureFlags.enableJobPosting === false) {
          return res.status(503).json({
            error: 'Hiring interview creation is currently disabled by system administration.',
            code: 'FEATURE_DISABLED',
            feature: featureFlags.enableInvitations === false ? 'enableInvitations' : 'enableJobPosting',
          });
        }
      }

      if (normalizedMode === 'HIRING') {
        const candidateProfile = await userStore.getById(normalizedCandidateId);
        if (!candidateProfile) {
          return res.status(404).json({
            error: 'Candidate not found',
            code: 'CANDIDATE_NOT_FOUND',
          });
        }
        if (String(candidateProfile.accountType || '').toUpperCase() !== 'CANDIDATE') {
          return res.status(400).json({
            error: 'candidateId must belong to a candidate account',
            code: 'INVALID_HIRING_CANDIDATE',
          });
        }

        if (jobId) {
          const job = await jobStore.getById(jobId);
          if (!job) {
            return res.status(404).json({
              error: 'Job not found',
              code: 'JOB_NOT_FOUND',
            });
          }
          if (job.organizationId !== organizationId) {
            return res.status(403).json({
              error: 'Job does not belong to your organization',
              code: 'JOB_ORG_MISMATCH',
            });
          }

          const linkedApplication = await jobApplicationStore.checkDuplicate(jobId, normalizedCandidateId);
          if (!linkedApplication && !invitationId) {
            return res.status(409).json({
              error: 'Candidate must have an application or invitation before creating a hiring interview',
              code: 'APPLICATION_OR_INVITATION_REQUIRED',
            });
          }

          const jobInterviews = await interviewStore.listByJob(jobId, { limit: 200 });
          const existingActiveInterview = jobInterviews.find((interview) =>
            interview.candidateId === normalizedCandidateId
            && !isTerminalInterviewStatus(interview.status),
          );
          if (existingActiveInterview) {
            const hydratedExisting = await attachSingleInterviewParticipants(existingActiveInterview);
            return res.json({
              success: true,
              interview: hydratedExisting,
              message: 'Existing active interview found',
              reusedExistingInterview: true,
            });
          }
        }
      }

      // For HIRING mode, use provided candidateId.
      // For PRACTICE mode, use the current user's ID.
      const finalCandidateId = normalizedMode === 'PRACTICE' ? userId : normalizedCandidateId;

      const interview = await interviewStore.create({
        mode: normalizedMode,
        candidateId: finalCandidateId,
        companyId: normalizedMode === 'HIRING' ? userId : null,
        organizationId: normalizedMode === 'HIRING' ? organizationId : null,
        jobId: jobId || null,
        jobStage: jobStage || null,
        invitationId: invitationId || null,
        status: status || 'SCHEDULED',
        pipelineStatus: pipelineStatus || null,
        reviewerAssignments: Array.isArray(reviewerAssignments) ? reviewerAssignments : [],
        jobRole,
        experienceLevel,
        industry,
        interviewTypes,
        skillFocus,
        duration,
        config: mergedInterviewConfig || null, // Store full config object (personality, voice, interviewerName, advancedSettings)
      });

      const hydrated = await attachSingleInterviewParticipants({ ...interview, questions: [] });

      try {
        await recordRealtimeEvent(interview.id, 'interview-created', {
          actor: userId,
          status: interview.status || 'SCHEDULED',
          mode: interview.mode || null,
        });
        if (interview.organizationId) {
          await publishOrganizationRealtimeUpdate(interview.organizationId, 'interview-created', {
            interviewId: interview.id,
            status: interview.status || 'SCHEDULED',
            candidateId: interview.candidateId || null,
            companyId: interview.companyId || null,
            jobId: interview.jobId || null,
          });
        }
      } catch (eventError) {
        logger.warn('Failed to publish interview-created realtime event:', eventError);
      }

      res.status(201).json({
        success: true,
        interview: hydrated,
      });
    } catch (error) {
      logger.error('Create interview error:', error);
      next(error);
    }
  }

  static async getInterview(req, res, next) {
    try {
      const { id } = req.params;
      const interview = await interviewStore.getWithQuestions(id);
      const access = ensureAccess(interview, req.user);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      const hydrated = await attachSingleInterviewParticipants(interview);

      res.json({ success: true, interview: hydrated });
    } catch (error) {
      logger.error('Get interview error:', error);
      next(error);
    }
  }

  /**
   * Record explicit consent for recording (audio/video) for this interview.
   * FR2: Consent and user controls for recorded text/audio/video.
   */
  static async recordRecordingConsent(req, res, next) {
    try {
      const { id } = req.params;
      const { recordingConsentGivenAt, recordingConsentVersion } = req.body;
      const interview = await interviewStore.getById(id);
      const access = ensureAccess(interview, req.user, { allowOrganizationMembers: false });
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      await interviewStore.update(id, {
        recordingConsentGivenAt: recordingConsentGivenAt || new Date().toISOString(),
        recordingConsentVersion: recordingConsentVersion || null,
      });

      res.json({
        success: true,
        message: 'Recording consent recorded',
      });
    } catch (error) {
      logger.error('Record recording consent error:', error);
      next(error);
    }
  }

  static async startInterview(req, res, next) {
    try {
      const { id } = req.params;
      let interview = await interviewStore.getWithQuestions(id);
      const access = ensureAccess(interview, req.user, { allowOrganizationMembers: false });
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      if (interview.status !== 'SCHEDULED' && interview.status !== 'PAUSED') {
        return res.status(400).json({ error: 'Interview cannot be started in current state' });
      }

      if (!interview.questions || interview.questions.length === 0) {
        const config = {
          jobRole: interview.jobRole,
          experienceLevel: interview.experienceLevel,
          industry: interview.industry,
          interviewTypes: interview.interviewTypes,
          skillFocus: interview.skillFocus || [], // Include skillFocus
          totalQuestions: Math.floor((interview.duration || 30) / 3),
          // Include personality and difficulty from config if available
          personality: interview.config?.personality || null,
          difficulty: interview.config?.advancedSettings?.difficulty || 'medium',
          interviewerName: interview.config?.interviewerName || null,
          llmOptions: resolveInterviewLlmOptions(interview.config),
        };

        const generatedQuestions = await LLMService.generateInterviewQuestions(config);
        await interviewStore.addQuestions(id, generatedQuestions);
        interview = await interviewStore.getWithQuestions(id);
      }

      const updatedInterview = await interviewStore.update(id, {
        status: 'IN_PROGRESS',
        startedAt: new Date().toISOString(),
      });

      try {
        await recordRealtimeEvent(id, 'interview-started', {
          actor: req.user.id,
          status: 'IN_PROGRESS',
          startedAt: updatedInterview.startedAt,
        });
        if (updatedInterview.organizationId) {
          await publishOrganizationRealtimeUpdate(updatedInterview.organizationId, 'interview-started', {
            interviewId: updatedInterview.id,
            status: 'IN_PROGRESS',
            startedAt: updatedInterview.startedAt,
            candidateId: updatedInterview.candidateId || null,
            companyId: updatedInterview.companyId || null,
            jobId: updatedInterview.jobId || null,
          });
        }
      } catch (eventError) {
        logger.warn('Failed to publish interview-started realtime event:', eventError);
      }

      const responseInterview = await attachSingleInterviewParticipants({
        ...updatedInterview,
        questions: interview.questions,
      });

      res.json({
        success: true,
        interview: responseInterview,
      });
    } catch (error) {
      logger.error('Start interview error:', error);
      next(error);
    }
  }

  static async endInterview(req, res, next) {
    try {
      const { id } = req.params;
      const interview = await interviewStore.getWithQuestions(id);
      const access = ensureAccess(interview, req.user, { allowOrganizationMembers: false });
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      const answeredQuestions = (interview.questions || []).filter((q) => q.answer);

      const evaluation = await LLMService.generateInterviewSummary({
        interview,
        questions: answeredQuestions,
        llmOptions: resolveInterviewLlmOptions(interview.config),
      });

      const updatedInterview = await interviewStore.update(id, {
        status: 'COMPLETED',
        endedAt: new Date().toISOString(),
        evaluation,
        overallScore: evaluation.overallScore,
        readinessLevel: evaluation.readinessLevel,
      });

      try {
        await recordRealtimeEvent(id, 'interview-ended', {
          actor: req.user.id,
          status: 'COMPLETED',
          endedAt: updatedInterview.endedAt,
          overallScore: updatedInterview.overallScore ?? null,
          readinessLevel: updatedInterview.readinessLevel ?? null,
        });
        if (updatedInterview.organizationId) {
          await publishOrganizationRealtimeUpdate(updatedInterview.organizationId, 'interview-ended', {
            interviewId: updatedInterview.id,
            status: 'COMPLETED',
            endedAt: updatedInterview.endedAt,
            overallScore: updatedInterview.overallScore ?? null,
            readinessLevel: updatedInterview.readinessLevel ?? null,
            candidateId: updatedInterview.candidateId || null,
            companyId: updatedInterview.companyId || null,
            jobId: updatedInterview.jobId || null,
          });
        }

        await publishAdminRealtimeUpdate('interview-completed', {
          interviewId: updatedInterview.id,
          organizationId: updatedInterview.organizationId || null,
          status: 'COMPLETED',
          endedAt: updatedInterview.endedAt,
          overallScore: updatedInterview.overallScore ?? null,
          readinessLevel: updatedInterview.readinessLevel ?? null,
        });
      } catch (eventError) {
        logger.warn('Failed to publish interview-ended realtime event:', eventError);
      }

      const hydrated = await attachSingleInterviewParticipants({
        ...updatedInterview,
        questions: interview.questions,
      });

      res.json({
        success: true,
        interview: hydrated,
      });
    } catch (error) {
      logger.error('End interview error:', error);
      next(error);
    }
  }

  static async getMyInterviews(req, res, next) {
    try {
      const userId = req.user.id;
      const accountType = req.user.accountType;
      const organizationId = req.user.organizationContext?.organization?.id || null;
      const requestedLimit = Number.parseInt(req.query.limit, 10);
      const listLimit = Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 200)
        : 100;

      const candidateInterviews = await interviewStore.listByCandidate(userId, { limit: listLimit });
      const companyInterviews = accountType === 'COMPANY'
        ? (organizationId
          ? await interviewStore.listByOrganization(organizationId, { limit: listLimit })
          : await interviewStore.listByCompany(userId, { limit: listLimit }))
        : [];

      const combinedMap = new Map();
      [...candidateInterviews, ...companyInterviews].forEach((interview) => {
        if (interview) combinedMap.set(interview.id, interview);
      });

      const interviewsArray = Array.from(combinedMap.values()).sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      );

      const hydrated = await hydrateInterviewParticipants(interviewsArray);

      res.json({ success: true, interviews: hydrated });
    } catch (error) {
      logger.error('Get my interviews error:', error);
      next(error);
    }
  }

  static async getCompanyInterviews(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id || null;
      const companyId = req.user.id;
      const requestedLimit = Number.parseInt(req.query.limit, 10);
      const listLimit = Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 200)
        : 100;
      const interviews = organizationId
        ? await interviewStore.listByOrganization(organizationId, { limit: listLimit })
        : await interviewStore.listByCompany(companyId, { limit: listLimit });
      const hydrated = await hydrateInterviewParticipants(interviews);

      res.json({ success: true, interviews: hydrated });
    } catch (error) {
      logger.error('Get company interviews error:', error);
      next(error);
    }
  }

  static async getEvaluation(req, res, next) {
    try {
      const { id } = req.params;
      const interview = await interviewStore.getWithQuestions(id);
      const access = ensureAccess(interview, req.user);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      const evaluation = {
        id: interview.id,
        evaluation: interview.evaluation,
        overallScore: interview.overallScore,
        readinessLevel: interview.readinessLevel,
        questions: (interview.questions || []).map((question) => ({
          id: question.id,
          question: question.question,
          answer: question.answer,
          score: question.score,
          feedback: question.feedback,
        })),
      };

      res.json({ success: true, evaluation });
    } catch (error) {
      logger.error('Get evaluation error:', error);
      next(error);
    }
  }

  static async submitAnswer(req, res, next) {
    try {
      const { id } = req.params;
      const { questionId, answer, audioUrl } = req.body;
      const interview = await interviewStore.getWithQuestions(id);
      const access = ensureAccess(interview, req.user, { allowOrganizationMembers: false });
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      if (interview.status !== 'IN_PROGRESS') {
        return res.status(400).json({ error: 'Interview is not in progress' });
      }

      const question = (interview.questions || []).find((q) => q.id === questionId);
      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }

      const askedAtDate = question.askedAt ? new Date(question.askedAt) : new Date();
      const answeredAt = new Date();
      const timeToAnswer = Math.floor((answeredAt.getTime() - askedAtDate.getTime()) / 1000);

      const updatedQuestion = await interviewStore.updateQuestion(id, questionId, {
        answer,
        answerAudioUrl: audioUrl || null,
        askedAt: question.askedAt || askedAtDate.toISOString(),
        answeredAt: answeredAt.toISOString(),
        timeToAnswer,
      });

      let evaluation = null;
      try {
        evaluation = await LLMService.analyzeAnswer({
          question: question.question,
          answer,
          criteria: question.evaluationCriteria,
          difficulty: question.difficulty,
          llmOptions: resolveInterviewLlmOptions(interview.config),
        });

        await interviewStore.updateQuestion(id, questionId, {
          score: evaluation.score || null,
          strengths: evaluation.strengths || [],
          weaknesses: evaluation.weaknesses || [],
          feedback: evaluation || null,
          followUpQuestion: evaluation.suggestions?.[0] || null,
        });
      } catch (evalError) {
        logger.error('Error evaluating answer:', evalError);
      }

      try {
        await recordRealtimeEvent(id, 'answer-submitted', {
          actor: req.user.id,
          questionId,
          answeredAt: updatedQuestion.answeredAt || answeredAt.toISOString(),
          score: evaluation?.score ?? updatedQuestion?.score ?? null,
        });
      } catch (eventError) {
        logger.warn('Failed to publish answer-submitted realtime event:', eventError);
      }

      res.json({
        success: true,
        question: updatedQuestion,
        evaluation,
      });
    } catch (error) {
      logger.error('Submit answer error:', error);
      next(error);
    }
  }

  static async markQuestionAsked(req, res, next) {
    try {
      const { id } = req.params;
      const { questionId } = req.body;
      const interview = await interviewStore.getById(id);
      const access = ensureAccess(interview, req.user, { allowOrganizationMembers: false });
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      const askedAt = new Date().toISOString();
      await interviewStore.updateQuestion(id, questionId, {
        askedAt,
      });

      try {
        await recordRealtimeEvent(id, 'question-asked', {
          actor: req.user.id,
          questionId,
          askedAt,
        });
      } catch (eventError) {
        logger.warn('Failed to publish question-asked realtime event:', eventError);
      }

      res.json({ success: true, questionId });
    } catch (error) {
      logger.error('Mark question asked error:', error);
      next(error);
    }
  }
}
