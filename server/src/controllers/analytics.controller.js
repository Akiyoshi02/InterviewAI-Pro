import { analyticsStore, interviewStore } from '../services/firebaseData.service.js';
import { queueAnalyticsJob } from '../services/backgroundJobQueue.service.js';
import logger from '../utils/logger.js';

export class AnalyticsController {
  static async getDashboard(req, res, next) {
    try {
      const userId = req.user.id;
      const accountType = req.user.accountType;

      const stats = await analyticsStore.getStatsForUser(userId, accountType);

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      logger.error('Get dashboard error:', error);
      next(error);
    }
  }

  static async getCompanyMetrics(req, res, next) {
    try {
      const companyId = req.user.id;

      const metrics = await analyticsStore.getCompanyMetrics(companyId);

      res.json({
        success: true,
        metrics,
      });
    } catch (error) {
      logger.error('Get company metrics error:', error);
      next(error);
    }
  }

  /**
   * Get comprehensive dashboard metrics with historical comparison data
   * This endpoint provides real-time metrics with week-over-week comparisons
   */
  static async getDashboardMetrics(req, res, next) {
    try {
      const organizationId = req.user.profile?.primaryOrganizationId;

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: 'Organization context required',
        });
      }

      const metrics = await analyticsStore.getDashboardMetricsWithComparison(organizationId);

      // Create a daily snapshot in background to keep response latency stable.
      queueAnalyticsJob({
        type: 'ORG_DAILY_SNAPSHOT',
        payload: { organizationId },
        handler: async ({ organizationId: orgId }) => {
          await analyticsStore.createDailySnapshot(orgId);
        },
      });

      res.json({
        success: true,
        metrics,
      });
    } catch (error) {
      logger.error('Get dashboard metrics error:', error);
      next(error);
    }
  }

  /**
   * Get historical metrics snapshots for trend analysis
   */
  static async getHistoricalMetrics(req, res, next) {
    try {
      const organizationId = req.user.profile?.primaryOrganizationId;
      const days = Math.min(parseInt(req.query.days, 10) || 7, 30); // Max 30 days

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: 'Organization context required',
        });
      }

      const snapshots = await analyticsStore.getSnapshots(organizationId, days);

      res.json({
        success: true,
        snapshots,
      });
    } catch (error) {
      logger.error('Get historical metrics error:', error);
      next(error);
    }
  }

  // ============================================
  // CANDIDATE ANALYTICS ENDPOINTS
  // ============================================

  /**
   * Get candidate dashboard metrics with historical comparison data
   * This endpoint provides real-time metrics with week-over-week comparisons for candidates
   */
  static async getCandidateDashboardMetrics(req, res, next) {
    try {
      const candidateId = req.user.id;

      if (req.user.accountType?.toUpperCase() !== 'CANDIDATE') {
        return res.status(403).json({
          success: false,
          error: 'This endpoint is for candidates only',
        });
      }

      const metrics = await analyticsStore.getCandidateDashboardMetricsWithComparison(candidateId);

      // Create candidate snapshot in background to avoid blocking dashboard responses.
      queueAnalyticsJob({
        type: 'CANDIDATE_DAILY_SNAPSHOT',
        payload: { candidateId },
        handler: async ({ candidateId: targetCandidateId }) => {
          await analyticsStore.createCandidateDailySnapshot(targetCandidateId);
        },
      });

      res.json({
        success: true,
        metrics,
      });
    } catch (error) {
      logger.error('Get candidate dashboard metrics error:', error);
      next(error);
    }
  }

  /**
   * Get candidate historical metrics snapshots for trend analysis
   */
  static async getCandidateHistoricalMetrics(req, res, next) {
    try {
      const candidateId = req.user.id;
      const days = Math.min(parseInt(req.query.days, 10) || 7, 30); // Max 30 days

      if (req.user.accountType?.toUpperCase() !== 'CANDIDATE') {
        return res.status(403).json({
          success: false,
          error: 'This endpoint is for candidates only',
        });
      }

      const snapshots = await analyticsStore.getCandidateSnapshots(candidateId, days);

      res.json({
        success: true,
        snapshots,
      });
    } catch (error) {
      logger.error('Get candidate historical metrics error:', error);
      next(error);
    }
  }

  /**
   * Get full candidate analytics — all interviews with scores for deep trend analysis
   */
  static async getCandidateFullAnalytics(req, res, next) {
    try {
      const candidateId = req.user.id;

      if (req.user.accountType?.toUpperCase() !== 'CANDIDATE') {
        return res.status(403).json({ success: false, error: 'Candidates only.' });
      }

      const interviews = await interviewStore.listByCandidate(candidateId);
      const completed = interviews
        .filter((iv) => iv.status === 'COMPLETED' && iv.overallScore != null)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      const trend = completed.map((iv, idx) => ({
        session: idx + 1,
        score: Math.round(iv.overallScore),
        date: iv.completedAt || iv.updatedAt || iv.createdAt,
        jobRole: iv.jobRole || 'Interview',
        interviewId: iv.id,
      }));

      // Skill aggregate from evaluation fields
      const techScores = completed
        .map((iv) => iv.evaluation?.technicalSkills?.score)
        .filter((s) => s != null);
      const commScores = completed
        .map((iv) => iv.evaluation?.communicationSkills?.score)
        .filter((s) => s != null);
      const avg = (arr) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

      const skillAverages = {
        technical: avg(techScores),
        communication: avg(commScores),
        overall: avg(completed.map((iv) => iv.overallScore)),
      };

      // Per-role breakdown
      const roleMap = {};
      completed.forEach((iv) => {
        const role = iv.jobRole || 'General';
        if (!roleMap[role]) roleMap[role] = { count: 0, totalScore: 0 };
        roleMap[role].count++;
        roleMap[role].totalScore += iv.overallScore;
      });
      const roleBreakdown = Object.entries(roleMap).map(([role, data]) => ({
        role,
        count: data.count,
        avgScore: Math.round(data.totalScore / data.count),
      }));

      // Weekly frequency
      const weeklyMap = {};
      completed.forEach((iv) => {
        const d = new Date(iv.completedAt || iv.createdAt);
        const weekKey = `${d.getFullYear()}-W${Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7)}`;
        weeklyMap[weekKey] = (weeklyMap[weekKey] || 0) + 1;
      });
      const weeklyFrequency = Object.entries(weeklyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([week, count]) => ({ week, count }));

      res.json({
        success: true,
        analytics: {
          totalSessions: completed.length,
          trend,
          skillAverages,
          roleBreakdown,
          weeklyFrequency,
          improvementDelta: trend.length >= 2
            ? trend[trend.length - 1].score - trend[0].score
            : null,
        },
      });
    } catch (error) {
      logger.error('Get candidate full analytics error:', error);
      next(error);
    }
  }

  /**
   * GET /api/analytics/longitudinal
   * Returns anonymised, aggregated interview data for all completed interviews
   * scoped to the requesting candidate, or all interviews if admin.
   * Data is anonymised server-side before returning.
   */
  static async getLongitudinalData(req, res, next) {
    try {
      const userId = req.user.id;
      const isAdmin = ['ADMIN', 'SYSTEM_ADMIN'].includes(req.user.accountType?.toUpperCase());

      let interviews;
      if (isAdmin) {
        // Admin: all completed interviews across all users (anonymised)
        interviews = await interviewStore.listAll?.() || await interviewStore.listByCandidate(userId);
      } else {
        interviews = await interviewStore.listByCandidate(userId);
      }

      const completed = interviews.filter((iv) => iv.status === 'COMPLETED');

      // Anonymise: strip PII, keep research-relevant fields
      const anonymisedData = completed.map((iv) => {
        const { id, userId: uid, createdAt, completedAt, updatedAt, jobRole, type, duration, overallScore, evaluation, emotionSummary, voiceAnalysis } = iv;
        return {
          sessionId: id,
          date: completedAt || updatedAt || createdAt,
          jobRole: jobRole || 'General',
          interviewType: type || 'Practice',
          duration: duration || null,
          overallScore: overallScore ?? null,
          technicalScore: evaluation?.technicalSkills?.score ?? null,
          communicationScore: evaluation?.communicationSkills?.score ?? null,
          engagementScore: emotionSummary?.avgEngagement ?? null,
          sentimentScore: emotionSummary?.avgSentiment ?? null,
          wpm: voiceAnalysis?.wpm ?? null,
          fillerRate: voiceAnalysis?.fillerRate ?? null,
          fluencyScore: voiceAnalysis?.fluencyScore ?? null,
        };
      });

      res.json({ success: true, data: anonymisedData, total: anonymisedData.length });
    } catch (error) {
      logger.error('Get longitudinal data error:', error);
      next(error);
    }
  }
}

