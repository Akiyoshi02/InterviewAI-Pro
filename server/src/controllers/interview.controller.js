import { LLMService } from '../services/llm.service.js';
import {
  hydrateInterviewParticipants,
  interviewStore,
  userStore,
} from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';

const ensureAccess = (interview, userId) => {
  if (!interview) {
    return { allowed: false, status: 404, message: 'Interview not found' };
  }

  if (interview.candidateId !== userId && interview.companyId !== userId) {
    return { allowed: false, status: 403, message: 'Access denied' };
  }

  return { allowed: true };
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

export class InterviewController {
  static async createInterview(req, res, next) {
    try {
      const { mode, jobRole, experienceLevel, industry, interviewTypes, skillFocus, duration, jobId, jobStage, invitationId, config } = req.body;
      const userId = req.user.id;
      const accountType = req.user.accountType;
      const organizationId = req.user.organizationContext?.organization?.id || null;

      if (mode === 'HIRING' && accountType !== 'COMPANY') {
        return res.status(403).json({ error: 'Only companies can create hiring interviews' });
      }

      if (mode === 'HIRING' && !organizationId) {
        return res.status(400).json({ error: 'Organization context required for hiring interviews' });
      }

      const interview = await interviewStore.create({
        mode,
        candidateId: mode === 'PRACTICE' ? userId : null,
        companyId: mode === 'HIRING' ? userId : null,
        organizationId: mode === 'HIRING' ? organizationId : null,
        jobId: jobId || null,
        jobStage: jobStage || null,
        invitationId: invitationId || null,
        jobRole,
        experienceLevel,
        industry,
        interviewTypes,
        skillFocus,
        duration,
        config: config || null, // Store full config object (personality, voice, interviewerName, advancedSettings)
      });

      const hydrated = await attachSingleInterviewParticipants({ ...interview, questions: [] });

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
      const userId = req.user.id;

      const interview = await interviewStore.getWithQuestions(id);
      const access = ensureAccess(interview, userId);
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

  static async startInterview(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      let interview = await interviewStore.getWithQuestions(id);
      const access = ensureAccess(interview, userId);
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
        };

        const generatedQuestions = await LLMService.generateInterviewQuestions(config);
        await interviewStore.addQuestions(id, generatedQuestions);
        interview = await interviewStore.getWithQuestions(id);
      }

      const updatedInterview = await interviewStore.update(id, {
        status: 'IN_PROGRESS',
        startedAt: new Date().toISOString(),
      });

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
      const userId = req.user.id;

      const interview = await interviewStore.getWithQuestions(id);
      const access = ensureAccess(interview, userId);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      const answeredQuestions = (interview.questions || []).filter((q) => q.answer);

      const evaluation = await LLMService.generateInterviewSummary({
        interview,
        questions: answeredQuestions,
      });

      const updatedInterview = await interviewStore.update(id, {
        status: 'COMPLETED',
        endedAt: new Date().toISOString(),
        evaluation,
        overallScore: evaluation.overallScore,
        readinessLevel: evaluation.readinessLevel,
      });

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

      const candidateInterviews = await interviewStore.listByCandidate(userId);
      const companyInterviews = accountType === 'COMPANY' ? await interviewStore.listByCompany(userId) : [];

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
      const companyId = req.user.id;
      const interviews = await interviewStore.listByCompany(companyId);
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
      const userId = req.user.id;

      const interview = await interviewStore.getWithQuestions(id);
      const access = ensureAccess(interview, userId);
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
      const userId = req.user.id;

      const interview = await interviewStore.getWithQuestions(id);
      const access = ensureAccess(interview, userId);
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
      const userId = req.user.id;

      const interview = await interviewStore.getById(id);
      const access = ensureAccess(interview, userId);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      await interviewStore.updateQuestion(id, questionId, {
        askedAt: new Date().toISOString(),
      });

      res.json({ success: true, questionId });
    } catch (error) {
      logger.error('Mark question asked error:', error);
      next(error);
    }
  }
}

