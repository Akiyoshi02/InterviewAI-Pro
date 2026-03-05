import {
  clearQuestionCatalogCache,
  getApprovedCatalog,
  listQuestionCatalogImports,
  listQuestionCatalogQuestions,
  listQuestionCatalogSources,
  updateQuestionCatalogReviewStatus,
} from '../services/questionCatalog.service.js';
import { importQuestionDataset } from '../services/questionCatalogImport.service.js';
import { publishAdminRealtimeUpdate } from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';

const toPositiveInt = (value, fallback, max = 1000) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

export class QuestionCatalogController {
  static async getSources(req, res, next) {
    try {
      const includeDisabled = req.query.includeDisabled === 'true';
      const manifest = listQuestionCatalogSources({ includeDisabled });
      return res.json({
        success: true,
        ...manifest,
      });
    } catch (error) {
      logger.error('Get question catalog sources error:', error);
      return next(error);
    }
  }

  static async importSource(req, res, next) {
    try {
      const { sourceKey, source, dryRun = false, approve = false, batchLabel } = req.body || {};
      const resolvedSourceKey = String(sourceKey || source || '').trim();
      if (!resolvedSourceKey) {
        return res.status(400).json({
          success: false,
          error: 'sourceKey is required',
        });
      }

      const result = await importQuestionDataset({
        sourceKey: resolvedSourceKey,
        dryRun: Boolean(dryRun),
        approve: Boolean(approve),
        batchLabel: String(batchLabel || '').trim() || undefined,
        reviewerId: req.user?.id || 'system-admin',
      });

      await publishAdminRealtimeUpdate('dataset-updated', {
        datasetType: 'question-catalog',
        action: 'imported',
        sourceKey: resolvedSourceKey,
        batchId: result.batchId,
        dryRun: Boolean(dryRun),
      });

      return res.status(dryRun ? 200 : 201).json({
        success: true,
        result,
      });
    } catch (error) {
      logger.error('Question catalog import error:', error);
      if (error?.status && error.status >= 400 && error.status < 500) {
        return res.status(error.status).json({
          success: false,
          error: error.message || 'Question catalog import failed',
          code: error.code || 'QUESTION_CATALOG_IMPORT_FAILED',
        });
      }
      return next(error);
    }
  }

  static async getImports(req, res, next) {
    try {
      const limit = toPositiveInt(req.query.limit, 50, 500);
      const imports = await listQuestionCatalogImports({ limit });
      return res.json({
        success: true,
        imports,
      });
    } catch (error) {
      logger.error('Get question catalog imports error:', error);
      return next(error);
    }
  }

  static async getQuestions(req, res, next) {
    try {
      const limit = toPositiveInt(req.query.limit, 200, 1000);
      const reviewStatus = req.query.reviewStatus ? String(req.query.reviewStatus).trim().toUpperCase() : null;
      const source = req.query.source ? String(req.query.source).trim().toUpperCase() : null;
      const type = req.query.type ? String(req.query.type).trim().toUpperCase() : null;
      const questions = await listQuestionCatalogQuestions({
        reviewStatus,
        source,
        type,
        limit,
      });

      return res.json({
        success: true,
        questions,
      });
    } catch (error) {
      logger.error('Get question catalog questions error:', error);
      return next(error);
    }
  }

  static async updateQuestionReview(req, res, next) {
    try {
      const { id } = req.params;
      const { questionIds = [], reviewStatus } = req.body || {};
      const candidateIds = Array.isArray(questionIds) && questionIds.length
        ? questionIds
        : [id];
      const result = await updateQuestionCatalogReviewStatus({
        questionIds: candidateIds,
        reviewStatus,
        reviewerId: req.user?.id || 'system-admin',
      });

      await publishAdminRealtimeUpdate('dataset-updated', {
        datasetType: 'question-catalog',
        action: 'review-updated',
        reviewStatus: result.reviewStatus,
        questionCount: result.questionIds.length,
      });

      return res.json({
        success: true,
        result,
      });
    } catch (error) {
      logger.error('Update question catalog review error:', error);
      if (error?.status && error.status >= 400 && error.status < 500) {
        return res.status(error.status).json({
          success: false,
          error: error.message || 'Failed to update review status',
          code: error.code || 'QUESTION_CATALOG_REVIEW_FAILED',
        });
      }
      return next(error);
    }
  }

  static async refreshCache(req, res, next) {
    try {
      clearQuestionCatalogCache();
      const catalog = await getApprovedCatalog({ includeQuestions: false, forceRefresh: true });
      return res.json({
        success: true,
        cacheRefreshed: true,
        metadata: catalog?.metadata || {},
        source: catalog?.source || 'STATIC_FALLBACK',
      });
    } catch (error) {
      logger.error('Refresh question catalog cache error:', error);
      return next(error);
    }
  }
}
