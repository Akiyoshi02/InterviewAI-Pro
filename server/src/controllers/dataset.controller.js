/**
 * Dataset Controller
 * 
 * Handles storage and retrieval of training datasets for:
 * - LLM interview conversation data
 * - MediaPipe posture/face-mesh analytics data
 * 
 * Endpoints:
 * - POST /api/datasets/interview - Save interview training data
 * - POST /api/datasets/analytics - Save posture/face analytics data
 * - GET /api/datasets - List all datasets (admin only)
 * - GET /api/datasets/export/:type - Export datasets in training format
 * - GET /api/datasets/statistics - Get dataset statistics
 * - DELETE /api/datasets/:id - Delete a dataset (admin only)
 */

import { firestore as db } from '../config/firebase.js';
import { publishAdminRealtimeUpdate } from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';

// Firestore collection names
const COLLECTIONS = {
  INTERVIEW_DATASETS: 'trainingDatasets_interviews',
  ANALYTICS_DATASETS: 'trainingDatasets_analytics',
  DATASET_METADATA: 'trainingDatasets_metadata',
};

/**
 * Save interview training dataset
 */
export const saveInterviewDataset = async (req, res) => {
  try {
    const userId = req.user?.uid;
    const {
      sessionId,
      interviewId,
      config,
      conversationTurns,
      questionAnswerPairs,
      summary,
      trainingData,
    } = req.body;

    // Validate required fields
    if (!sessionId || !conversationTurns || conversationTurns.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: sessionId and conversationTurns are required',
      });
    }

    // Prepare dataset document
    const dataset = {
      sessionId,
      interviewId: interviewId || null,
      userId: userId || 'anonymous',
      config: {
        jobRole: config?.jobRole || 'General',
        experienceLevel: config?.experienceLevel || 'Mid-level',
        industry: config?.industry || 'Technology',
        interviewTypes: config?.interviewTypes || ['behavioral'],
        personality: config?.personality || 'professional-encouraging',
      },
      data: {
        conversationTurns: conversationTurns.map(turn => ({
          role: turn.role,
          content: turn.content,
          timestamp: turn.timestamp,
          metadata: turn.metadata || {},
        })),
        questionAnswerPairs: (questionAnswerPairs || []).map(qa => ({
          question: qa.question,
          answer: qa.answer,
          evaluation: qa.evaluation || {},
          timestamp: qa.timestamp,
        })),
      },
      summary: summary || {},
      trainingData: trainingData || [],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dataVersion: '1.0',
        platform: 'InterviewAI Pro',
        qualityScore: calculateQualityScore(questionAnswerPairs),
      },
    };

    // Save to Firestore
    const docRef = await db.collection(COLLECTIONS.INTERVIEW_DATASETS).add(dataset);

    // Update metadata collection
    await updateDatasetMetadata('interview');

    await publishAdminRealtimeUpdate('dataset-updated', {
      datasetType: 'interview',
      action: 'created',
      datasetId: docRef.id,
    });

    logger.info(`Interview dataset saved: ${docRef.id} by user ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Interview dataset saved successfully',
      datasetId: docRef.id,
      summary: {
        totalTurns: conversationTurns.length,
        totalQAPairs: questionAnswerPairs?.length || 0,
        qualityScore: dataset.metadata.qualityScore,
      },
    });
  } catch (error) {
    logger.error('Error saving interview dataset:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save interview dataset',
      error: error.message,
    });
  }
};

/**
 * Save posture/face analytics dataset
 */
export const saveAnalyticsDataset = async (req, res) => {
  try {
    const userId = req.user?.uid;
    const {
      interviewId,
      sessionId,
      dataPoints,
      summary,
      config,
    } = req.body;

    // Validate required fields
    if (!sessionId || !dataPoints || dataPoints.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: sessionId and dataPoints are required',
      });
    }

    // Prepare analytics dataset document
    const dataset = {
      sessionId,
      interviewId: interviewId || null,
      userId: userId || 'anonymous',
      config: {
        enablePose: config?.enablePose ?? true,
        enableFace: config?.enableFace ?? true,
        detectionInterval: config?.detectionInterval || 100,
      },
      data: {
        dataPoints: dataPoints.map(point => ({
          timestamp: point.timestamp,
          frameNumber: point.frameNumber,
          pose: point.pose || {},
          face: point.face || {},
          bodyLanguage: point.bodyLanguage || {},
          scores: point.scores || {},
        })),
        totalFrames: dataPoints.length,
        duration: dataPoints.length > 0
          ? dataPoints[dataPoints.length - 1].timestamp - dataPoints[0].timestamp
          : 0,
      },
      summary: summary || {},
      referenceComparison: calculateReferenceComparison(dataPoints),
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dataVersion: '1.0',
        platform: 'InterviewAI Pro',
      },
    };

    // Save to Firestore
    const docRef = await db.collection(COLLECTIONS.ANALYTICS_DATASETS).add(dataset);

    // Update metadata collection
    await updateDatasetMetadata('analytics');

    await publishAdminRealtimeUpdate('dataset-updated', {
      datasetType: 'analytics',
      action: 'created',
      datasetId: docRef.id,
    });

    logger.info(`Analytics dataset saved: ${docRef.id} by user ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Analytics dataset saved successfully',
      datasetId: docRef.id,
      summary: {
        totalFrames: dataPoints.length,
        duration: dataset.data.duration,
        averageScores: dataset.referenceComparison.averages,
      },
    });
  } catch (error) {
    logger.error('Error saving analytics dataset:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save analytics dataset',
      error: error.message,
    });
  }
};

/**
 * List datasets (admin only)
 */
export const listDatasets = async (req, res) => {
  try {
    const { type = 'all', limit = 50, offset = 0 } = req.query;

    const results = {
      interview: [],
      analytics: [],
    };

    // Fetch interview datasets
    if (type === 'all' || type === 'interview') {
      const interviewSnapshot = await db
        .collection(COLLECTIONS.INTERVIEW_DATASETS)
        .orderBy('metadata.createdAt', 'desc')
        .limit(parseInt(limit))
        .offset(parseInt(offset))
        .get();

      results.interview = interviewSnapshot.docs.map(doc => ({
        id: doc.id,
        sessionId: doc.data().sessionId,
        config: doc.data().config,
        summary: doc.data().summary,
        metadata: doc.data().metadata,
        totalTurns: doc.data().data?.conversationTurns?.length || 0,
        totalQAPairs: doc.data().data?.questionAnswerPairs?.length || 0,
      }));
    }

    // Fetch analytics datasets
    if (type === 'all' || type === 'analytics') {
      const analyticsSnapshot = await db
        .collection(COLLECTIONS.ANALYTICS_DATASETS)
        .orderBy('metadata.createdAt', 'desc')
        .limit(parseInt(limit))
        .offset(parseInt(offset))
        .get();

      results.analytics = analyticsSnapshot.docs.map(doc => ({
        id: doc.id,
        sessionId: doc.data().sessionId,
        config: doc.data().config,
        summary: doc.data().summary,
        metadata: doc.data().metadata,
        totalFrames: doc.data().data?.totalFrames || 0,
        duration: doc.data().data?.duration || 0,
      }));
    }

    res.status(200).json({
      success: true,
      datasets: results,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    logger.error('Error listing datasets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list datasets',
      error: error.message,
    });
  }
};

/**
 * Export datasets in training format
 */
export const exportDatasets = async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'jsonl', minQuality = 0 } = req.query;

    if (type === 'interview') {
      // Export interview datasets
      const snapshot = await db
        .collection(COLLECTIONS.INTERVIEW_DATASETS)
        .where('metadata.qualityScore', '>=', parseInt(minQuality))
        .get();

      const trainingExamples = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.trainingData && data.trainingData.length > 0) {
          trainingExamples.push(...data.trainingData);
        }
      });

      if (format === 'jsonl') {
        const jsonlContent = trainingExamples.map(ex => JSON.stringify(ex)).join('\n');
        res.setHeader('Content-Type', 'application/jsonl');
        res.setHeader('Content-Disposition', 'attachment; filename=interview_training_data.jsonl');
        return res.send(jsonlContent);
      }

      res.json({
        success: true,
        format: 'json',
        totalExamples: trainingExamples.length,
        data: trainingExamples,
      });

    } else if (type === 'analytics') {
      // Export analytics datasets
      const snapshot = await db
        .collection(COLLECTIONS.ANALYTICS_DATASETS)
        .get();

      const analyticsData = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        analyticsData.push({
          sessionId: data.sessionId,
          config: data.config,
          referenceComparison: data.referenceComparison,
          dataPoints: data.data?.dataPoints || [],
        });
      });

      if (format === 'jsonl') {
        const jsonlContent = analyticsData.map(d => JSON.stringify(d)).join('\n');
        res.setHeader('Content-Type', 'application/jsonl');
        res.setHeader('Content-Disposition', 'attachment; filename=analytics_training_data.jsonl');
        return res.send(jsonlContent);
      }

      res.json({
        success: true,
        format: 'json',
        totalSessions: analyticsData.length,
        data: analyticsData,
      });

    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid export type. Use "interview" or "analytics".',
      });
    }
  } catch (error) {
    logger.error('Error exporting datasets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export datasets',
      error: error.message,
    });
  }
};

/**
 * Get dataset statistics
 */
export const getDatasetStatistics = async (req, res) => {
  try {
    // Get interview statistics
    const interviewSnapshot = await db
      .collection(COLLECTIONS.INTERVIEW_DATASETS)
      .get();

    let interviewStats = {
      totalSessions: interviewSnapshot.size,
      totalQAPairs: 0,
      totalConversationTurns: 0,
      highQualityPairs: 0,
      byRole: {},
      byExperience: {},
      byType: {},
    };

    interviewSnapshot.docs.forEach(doc => {
      const data = doc.data();
      interviewStats.totalConversationTurns += data.data?.conversationTurns?.length || 0;
      interviewStats.totalQAPairs += data.data?.questionAnswerPairs?.length || 0;
      
      const qualityPairs = (data.data?.questionAnswerPairs || [])
        .filter(qa => (qa.evaluation?.score || 0) >= 7).length;
      interviewStats.highQualityPairs += qualityPairs;

      const role = data.config?.jobRole || 'Unknown';
      interviewStats.byRole[role] = (interviewStats.byRole[role] || 0) + 1;

      const exp = data.config?.experienceLevel || 'Unknown';
      interviewStats.byExperience[exp] = (interviewStats.byExperience[exp] || 0) + 1;
    });

    // Get analytics statistics
    const analyticsSnapshot = await db
      .collection(COLLECTIONS.ANALYTICS_DATASETS)
      .get();

    let analyticsStats = {
      totalSessions: analyticsSnapshot.size,
      totalFrames: 0,
      totalDuration: 0,
      averagePostureScore: 0,
      averageAttentionScore: 0,
    };

    let postureScoreSum = 0;
    let attentionScoreSum = 0;
    let sessionCount = 0;

    analyticsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      analyticsStats.totalFrames += data.data?.totalFrames || 0;
      analyticsStats.totalDuration += data.data?.duration || 0;

      if (data.referenceComparison?.averages) {
        postureScoreSum += data.referenceComparison.averages.posture || 0;
        attentionScoreSum += data.referenceComparison.averages.attention || 0;
        sessionCount++;
      }
    });

    if (sessionCount > 0) {
      analyticsStats.averagePostureScore = Math.round(postureScoreSum / sessionCount);
      analyticsStats.averageAttentionScore = Math.round(attentionScoreSum / sessionCount);
    }

    res.json({
      success: true,
      statistics: {
        interview: interviewStats,
        analytics: analyticsStats,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error getting dataset statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dataset statistics',
      error: error.message,
    });
  }
};

/**
 * Delete a dataset (admin only)
 */
export const deleteDataset = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    if (!type || !['interview', 'analytics'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Must be "interview" or "analytics".',
      });
    }

    const collection = type === 'interview'
      ? COLLECTIONS.INTERVIEW_DATASETS
      : COLLECTIONS.ANALYTICS_DATASETS;

    await db.collection(collection).doc(id).delete();

    await publishAdminRealtimeUpdate('dataset-updated', {
      datasetType: type,
      action: 'deleted',
      datasetId: id,
    });

    logger.info(`Dataset deleted: ${id} (type: ${type})`);

    res.json({
      success: true,
      message: 'Dataset deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting dataset:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete dataset',
      error: error.message,
    });
  }
};

/**
 * Helper: Calculate quality score for interview data
 */
function calculateQualityScore(questionAnswerPairs) {
  if (!questionAnswerPairs || questionAnswerPairs.length === 0) return 0;

  const scores = questionAnswerPairs.map(qa => qa.evaluation?.score || 0);
  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  
  // Quality score based on average evaluation score and data completeness
  const completenessBonus = questionAnswerPairs.every(qa => 
    qa.question?.text && qa.answer?.text
  ) ? 10 : 0;

  return Math.round(Math.min(100, avgScore * 10 + completenessBonus));
}

/**
 * Helper: Calculate reference comparison for analytics data
 */
function calculateReferenceComparison(dataPoints) {
  if (!dataPoints || dataPoints.length === 0) {
    return { averages: {}, deviations: {} };
  }

  let postureSum = 0;
  let attentionSum = 0;
  let bodyLanguageSum = 0;
  let overallSum = 0;

  dataPoints.forEach(point => {
    postureSum += point.scores?.posture || 0;
    attentionSum += point.scores?.attention || 0;
    bodyLanguageSum += point.scores?.bodyLanguage || 0;
    overallSum += point.scores?.overall || 0;
  });

  const count = dataPoints.length;

  return {
    averages: {
      posture: Math.round(postureSum / count),
      attention: Math.round(attentionSum / count),
      bodyLanguage: Math.round(bodyLanguageSum / count),
      overall: Math.round(overallSum / count),
    },
    deviations: {
      // Could calculate standard deviations here if needed
    },
    sampleCount: count,
  };
}

/**
 * Helper: Update dataset metadata
 */
async function updateDatasetMetadata(type) {
  try {
    const metaRef = db.collection(COLLECTIONS.DATASET_METADATA).doc('summary');
    
    await metaRef.set({
      lastUpdated: new Date().toISOString(),
      [`last${type.charAt(0).toUpperCase() + type.slice(1)}Upload`]: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    logger.warn('Failed to update dataset metadata:', error);
  }
}

export default {
  saveInterviewDataset,
  saveAnalyticsDataset,
  listDatasets,
  exportDatasets,
  getDatasetStatistics,
  deleteDataset,
};
