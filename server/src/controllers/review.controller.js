import {
  activityLogStore,
  interviewStore,
  publishAdminRealtimeUpdate,
  publishOrganizationRealtimeUpdate,
  recordRealtimeEvent,
  reviewStore,
  userStore,
} from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';

const sanitizeReview = (review, reviewerSummary = null) => ({
  id: review.id,
  interviewId: review.interviewId,
  interviewerId: review.interviewId, // backward-compatible alias
  reviewerId: review.reviewerId,
  reviewerRole: review.reviewerRole,
  score: review.score,
  decision: review.decision,
  strengths: review.strengths || [],
  weaknesses: review.weaknesses || [],
  notes: review.notes || '',
  rating: review.rating,
  technicalScore: review.technicalScore,
  communicationScore: review.communicationScore,
  problemSolvingScore: review.problemSolvingScore,
  culturalFitScore: review.culturalFitScore,
  recommendation: review.recommendation,
  aiOverallScoreAtReview: review.aiOverallScoreAtReview,
  smeOverallScore: review.smeOverallScore,
  overrideOverall: review.overrideOverall,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
  reviewer: reviewerSummary
    ? {
        id: reviewerSummary.id,
        fullName: reviewerSummary.fullName,
        email: reviewerSummary.email,
      }
    : null,
});

function computeSmeOverallScore(body) {
  const rating = body.rating != null ? Number(body.rating) : null;
  if (rating != null && !Number.isNaN(rating)) {
    return Math.min(100, Math.max(0, rating * 10));
  }
  const technical = body.technicalScore != null ? Number(body.technicalScore) : null;
  const communication = body.communicationScore != null ? Number(body.communicationScore) : null;
  const problemSolving = body.problemSolvingScore != null ? Number(body.problemSolvingScore) : null;
  const culturalFit = body.culturalFitScore != null ? Number(body.culturalFitScore) : null;
  const scores = [technical, communication, problemSolving, culturalFit].filter(
    (s) => s != null && !Number.isNaN(s)
  );
  if (scores.length === 0) return null;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.min(100, Math.max(0, avg * 10));
}

export class ReviewController {
  static async getMyReview(req, res, next) {
    try {
      const { interviewId } = req.params;
      const userId = req.user.id;
      const interview = await interviewStore.getById(interviewId);
      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
      }
      const organizationId = req.user.organizationContext?.organization?.id;
      if (interview.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const review = await reviewStore.getByInterviewAndReviewer(interviewId, userId);
      if (!review) {
        return res.json({ success: true, review: null });
      }
      const reviewerSummary = await userStore.getSummary(review.reviewerId);
      res.json({
        success: true,
        review: sanitizeReview(review, reviewerSummary),
      });
    } catch (error) {
      logger.error('Get my review error:', error);
      next(error);
    }
  }

  static async listReviews(req, res, next) {
    try {
      const { interviewId } = req.params;
      const interview = await interviewStore.getById(interviewId);
      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
      }

      const organizationId = req.user.organizationContext?.organization?.id;
      if (interview.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const reviews = await reviewStore.listByInterview(interviewId);
      const reviewers = await userStore.getSummaries(reviews.map((review) => review.reviewerId));

      res.json({
        success: true,
        reviews: reviews.map((review) => sanitizeReview(review, reviewers.get(review.reviewerId))),
      });
    } catch (error) {
      logger.error('List reviews error:', error);
      next(error);
    }
  }

  static async submitReview(req, res, next) {
    try {
      const { interviewId } = req.params;
      const interview = await interviewStore.getById(interviewId);
      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
      }

      const organizationId = req.user.organizationContext?.organization?.id;
      if (interview.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const aiOverallScoreAtReview =
        interview.overallScore != null ? Number(interview.overallScore) : null;
      const smeOverallScore = computeSmeOverallScore(req.body);
      const overrideOverall = Boolean(req.body.overrideOverall);

      const review = await reviewStore.submit(interviewId, {
        reviewerId: req.user.id,
        reviewerRole: req.user.organizationContext?.membership?.role,
        ...req.body,
        aiOverallScoreAtReview,
        smeOverallScore,
        overrideOverall,
      });

      if (overrideOverall && smeOverallScore != null) {
        await interviewStore.update(interviewId, {
          finalOverallScore: smeOverallScore,
          finalScoreSource: 'SME',
        });
      }

      const reviewerSummary = await userStore.getSummary(req.user.id);

      await activityLogStore.record({
        organizationId,
        actorId: req.user.id,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'REVIEW_SUBMITTED',
        targetType: 'INTERVIEW',
        targetId: interviewId,
        metadata: {
          decision: req.body.decision || req.body.recommendation || null,
          score: req.body.score ?? smeOverallScore ?? null,
          overrideOverall,
          aiOverallScoreAtReview,
        },
      });

      try {
        await recordRealtimeEvent(interviewId, 'review-submitted', {
          actor: req.user.id,
          status: interview.status || null,
          decision: req.body.decision || req.body.recommendation || null,
          score: req.body.score ?? smeOverallScore ?? null,
          overrideOverall,
          finalOverallScore:
            overrideOverall && smeOverallScore != null
              ? smeOverallScore
              : interview.finalOverallScore ?? interview.overallScore ?? null,
        });

        await publishOrganizationRealtimeUpdate(organizationId, 'review-submitted', {
          interviewId,
          reviewerId: req.user.id,
          decision: req.body.decision || req.body.recommendation || null,
          score: req.body.score ?? smeOverallScore ?? null,
          overrideOverall,
        });

        await publishAdminRealtimeUpdate('review-submitted', {
          interviewId,
          organizationId,
          reviewerId: req.user.id,
          decision: req.body.decision || req.body.recommendation || null,
          score: req.body.score ?? smeOverallScore ?? null,
          overrideOverall,
          aiOverallScoreAtReview: aiOverallScoreAtReview ?? null,
          smeOverallScore: smeOverallScore ?? null,
        });
      } catch (realtimeError) {
        logger.warn('Failed to publish review realtime updates:', realtimeError);
      }

      res.status(201).json({
        success: true,
        review: sanitizeReview(review, reviewerSummary),
      });
    } catch (error) {
      logger.error('Submit review error:', error);
      next(error);
    }
  }
}
