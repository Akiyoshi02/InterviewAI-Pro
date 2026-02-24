import { savedAnswerStore } from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';

/**
 * GAP FEATURE: Personal Answer Library
 * Controller for managing saved interview answers
 */
export class SavedAnswerController {
  /**
   * Save an answer to personal library
   */
  static async saveAnswer(req, res, next) {
    try {
      const { questionText, answer, interviewId, questionId, notes, tags, rating } = req.body;
      const userId = req.user.id;

      if (!questionText || !answer) {
        return res.status(400).json({
          error: 'questionText and answer are required',
        });
      }

      const savedAnswer = await savedAnswerStore.create({
        userId,
        questionText,
        answer,
        interviewId,
        questionId,
        notes,
        tags,
        rating,
      });

      logger.info(`Answer saved to library: ${savedAnswer.id} by user ${userId}`);

      res.status(201).json({
        success: true,
        savedAnswer,
      });
    } catch (error) {
      logger.error('Save answer error:', error);
      next(error);
    }
  }

  /**
   * Get user's saved answers
   */
  static async listSavedAnswers(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit, tag } = req.query;

      const savedAnswers = await savedAnswerStore.listByUser(userId, {
        limit: limit ? parseInt(limit, 10) : 100,
        tag,
      });

      res.json({
        success: true,
        savedAnswers,
        count: savedAnswers.length,
      });
    } catch (error) {
      logger.error('List saved answers error:', error);
      next(error);
    }
  }

  /**
   * Update saved answer
   */
  static async updateSavedAnswer(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { notes, tags, rating } = req.body;

      // Get existing answer to verify ownership
      const existing = await savedAnswerStore.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Saved answer not found' });
      }

      if (existing.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updated = await savedAnswerStore.update(id, {
        notes,
        tags,
        rating,
      });

      res.json({
        success: true,
        savedAnswer: updated,
      });
    } catch (error) {
      logger.error('Update saved answer error:', error);
      next(error);
    }
  }

  /**
   * Delete saved answer
   */
  static async deleteSavedAnswer(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Get existing answer to verify ownership
      const existing = await savedAnswerStore.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Saved answer not found' });
      }

      if (existing.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await savedAnswerStore.delete(id);

      res.json({
        success: true,
        message: 'Saved answer deleted',
      });
    } catch (error) {
      logger.error('Delete saved answer error:', error);
      next(error);
    }
  }
}
