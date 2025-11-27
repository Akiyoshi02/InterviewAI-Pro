import { activityLogStore, interviewStore, reviewStore, userStore } from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';

const sanitizeReview = (review, reviewerSummary = null) => ({
  id: review.id,
  interviewerId: review.interviewId,
  reviewerId: review.reviewerId,
  reviewerRole: review.reviewerRole,
  score: review.score,
  decision: review.decision,
  strengths: review.strengths || [],
  weaknesses: review.weaknesses || [],
  notes: review.notes || '',
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

export class ReviewController {
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

      const review = await reviewStore.submit(interviewId, {
        reviewerId: req.user.id,
        reviewerRole: req.user.organizationContext?.membership?.role,
        ...req.body,
      });

      const reviewerSummary = await userStore.getSummary(req.user.id);

      await activityLogStore.record({
        organizationId,
        actorId: req.user.id,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'REVIEW_SUBMITTED',
        targetType: 'INTERVIEW',
        targetId: interviewId,
        metadata: {
          decision: req.body.decision || null,
          score: req.body.score || null,
        },
      });

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

