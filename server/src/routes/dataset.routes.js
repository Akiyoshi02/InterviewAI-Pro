/**
 * Dataset Routes
 * 
 * API routes for training dataset management:
 * - Interview conversation data
 * - Posture/face analytics data
 * 
 * Routes:
 * POST   /api/datasets/interview     - Save interview training data
 * POST   /api/datasets/analytics     - Save posture/face analytics data
 * GET    /api/datasets               - List all datasets (admin)
 * GET    /api/datasets/statistics    - Get dataset statistics
 * GET    /api/datasets/export/:type  - Export datasets in training format
 * DELETE /api/datasets/:id           - Delete a dataset (admin)
 */

import express from 'express';
import {
  saveInterviewDataset,
  saveAnalyticsDataset,
  listDatasets,
  exportDatasets,
  getDatasetStatistics,
  deleteDataset,
} from '../controllers/dataset.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.middleware.js';
import { requireSystemAdmin } from '../middleware/admin.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/datasets/interview
 * @desc    Save interview training dataset
 * @access  Authenticated (optional - allows anonymous collection)
 */
router.post('/interview', optionalAuth, saveInterviewDataset);

/**
 * @route   POST /api/datasets/analytics
 * @desc    Save posture/face analytics dataset
 * @access  Authenticated (optional - allows anonymous collection)
 */
router.post('/analytics', optionalAuth, saveAnalyticsDataset);

/**
 * @route   GET /api/datasets
 * @desc    List all datasets
 * @access  System Admin only
 * @query   type - 'all', 'interview', or 'analytics'
 * @query   limit - Number of results (default 50)
 * @query   offset - Offset for pagination (default 0)
 */
router.get('/', authenticate, requireSystemAdmin, listDatasets);

/**
 * @route   GET /api/datasets/statistics
 * @desc    Get dataset statistics
 * @access  System Admin only
 */
router.get('/statistics', authenticate, requireSystemAdmin, getDatasetStatistics);

/**
 * @route   GET /api/datasets/export/:type
 * @desc    Export datasets in training format
 * @access  System Admin only
 * @params  type - 'interview' or 'analytics'
 * @query   format - 'jsonl' or 'json' (default 'jsonl')
 * @query   minQuality - Minimum quality score filter (default 0)
 */
router.get('/export/:type', authenticate, requireSystemAdmin, exportDatasets);

/**
 * @route   DELETE /api/datasets/:id
 * @desc    Delete a dataset
 * @access  System Admin only
 * @query   type - 'interview' or 'analytics'
 */
router.delete('/:id', authenticate, requireSystemAdmin, deleteDataset);

export default router;
