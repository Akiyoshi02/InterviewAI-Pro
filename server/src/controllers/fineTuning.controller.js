/**
 * Fine-Tuning Controller
 *
 * API endpoints for triggering model fine-tuning, checking status,
 * and running before/after evaluations.
 */

import {
  triggerFineTune,
  getFineTuneStatus,
  evaluateFineTunedModel,
  exportTrainingDataAsJSONL,
  importTrainedGGUF,
} from '../services/modelFineTuning.service.js';
import logger from '../utils/logger.js';

export class FineTuningController {
  /**
   * POST /api/admin/fine-tune
   * Trigger fine-tuning from collected data
   */
  static async triggerFineTune(req, res, next) {
    try {
      logger.info(`Fine-tune triggered by admin ${req.user?.id}`);
      const result = await triggerFineTune();

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      res.json({
        success: true,
        message: 'Model fine-tuning completed successfully',
        ...result,
      });
    } catch (error) {
      logger.error('Fine-tune trigger error:', error);
      next(error);
    }
  }

  /**
   * GET /api/admin/fine-tune/status
   * Get fine-tuning status
   */
  static async getStatus(req, res, next) {
    try {
      const status = await getFineTuneStatus();
      res.json({ success: true, ...status });
    } catch (error) {
      logger.error('Fine-tune status error:', error);
      next(error);
    }
  }

  /**
   * POST /api/admin/fine-tune/evaluate
   * Run before/after evaluation
   */
  static async evaluate(req, res, next) {
    try {
      logger.info(`Fine-tune evaluation triggered by admin ${req.user?.id}`);
      const result = await evaluateFineTunedModel();
      res.json({ success: true, evaluation: result });
    } catch (error) {
      logger.error('Fine-tune evaluation error:', error);
      next(error);
    }
  }

  /**
   * GET /api/admin/fine-tune/export
   * Export training data as JSONL for use with scripts/fine_tune_lora.py
   */
  static async exportTrainingData(req, res, next) {
    try {
      logger.info(`Training data export requested by admin ${req.user?.id}`);
      const result = await exportTrainingDataAsJSONL();

      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }

      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="interviewai_training_${Date.now()}.jsonl"`,
      );
      res.send(result.jsonl);
    } catch (error) {
      logger.error('Training data export error:', error);
      next(error);
    }
  }

  /**
   * POST /api/admin/fine-tune/import-gguf
   * Register a LoRA-trained GGUF file with Ollama as the fine-tuned model.
   * Body: { ggufPath: string }
   */
  static async importGGUF(req, res, next) {
    try {
      const { ggufPath } = req.body;
      if (!ggufPath || typeof ggufPath !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'ggufPath is required and must be a string (absolute path on the server).',
        });
      }

      logger.info(`GGUF import requested by admin ${req.user?.id}: ${ggufPath}`);
      const result = await importTrainedGGUF(ggufPath.trim());

      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }

      res.json({
        success: true,
        message: `Model ${result.modelName} registered successfully from GGUF. It will be preferred at runtime.`,
        ...result,
      });
    } catch (error) {
      logger.error('GGUF import error:', error);
      next(error);
    }
  }
}
