import { activityLogStore, jobStore } from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';

const sanitizeJob = (job) => {
  if (!job) return null;
  return {
    id: job.id,
    organizationId: job.organizationId,
    title: job.title,
    department: job.department,
    location: job.location,
    employmentType: job.employmentType,
    experienceLevel: job.experienceLevel,
    compensationRange: job.compensationRange,
    description: job.description,
    requirements: job.requirements || [],
    responsibilities: job.responsibilities || [],
    skills: job.skills || [],
    status: job.status,
    stages: job.stages || [],
    templateConfig: job.templateConfig || {},
    publishedAt: job.publishedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
};

export class JobController {
  static async createJob(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization context required' });
      }

      const job = await jobStore.create({
        organizationId,
        createdBy: req.user.id,
        ...req.body,
      });

      await activityLogStore.record({
        organizationId,
        actorId: req.user.id,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'JOB_CREATED',
        targetType: 'JOB',
        targetId: job.id,
        metadata: { title: job.title },
      });

      res.status(201).json({ success: true, job: sanitizeJob(job) });
    } catch (error) {
      logger.error('Create job error:', error);
      next(error);
    }
  }

  static async updateJob(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const jobId = req.params.id;

      const existing = await jobStore.getById(jobId);
      if (!existing || existing.organizationId !== organizationId) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const updated = await jobStore.update(jobId, req.body);
      await activityLogStore.record({
        organizationId,
        actorId: req.user.id,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'JOB_UPDATED',
        targetType: 'JOB',
        targetId: updated.id,
        metadata: { title: updated.title },
      });
      res.json({ success: true, job: sanitizeJob(updated) });
    } catch (error) {
      logger.error('Update job error:', error);
      next(error);
    }
  }

  static async getJob(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const jobId = req.params.id;

      const job = await jobStore.getById(jobId);
      if (!job || job.organizationId !== organizationId) {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json({ success: true, job: sanitizeJob(job) });
    } catch (error) {
      logger.error('Get job error:', error);
      next(error);
    }
  }

  static async listJobs(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const jobs = await jobStore.listByOrganization(organizationId);
      res.json({ success: true, jobs: jobs.map(sanitizeJob) });
    } catch (error) {
      logger.error('List jobs error:', error);
      next(error);
    }
  }

  static async listPublicJobs(req, res, next) {
    try {
      const jobs = await jobStore.listPublished(parseInt(req.query.limit, 10) || 20);
      const sanitized = jobs.map((job) => ({
        id: job.id,
        title: job.title,
        department: job.department,
        location: job.location,
        employmentType: job.employmentType,
        experienceLevel: job.experienceLevel,
        description: job.description,
        requirements: job.requirements || [],
        responsibilities: job.responsibilities || [],
        skills: job.skills || [],
        publishedAt: job.publishedAt,
        organizationId: job.organizationId,
      }));
      res.json({ success: true, jobs: sanitized });
    } catch (error) {
      logger.error('List public jobs error:', error);
      next(error);
    }
  }

  static async getPublicJob(req, res, next) {
    try {
      const job = await jobStore.getById(req.params.id);
      if (!job || job.status !== 'PUBLISHED') {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json({
        success: true,
        job: {
          id: job.id,
          title: job.title,
          department: job.department,
          location: job.location,
          employmentType: job.employmentType,
          experienceLevel: job.experienceLevel,
          description: job.description,
          requirements: job.requirements || [],
          responsibilities: job.responsibilities || [],
          skills: job.skills || [],
          publishedAt: job.publishedAt,
          organizationId: job.organizationId,
        },
      });
    } catch (error) {
      logger.error('Get public job error:', error);
      next(error);
    }
  }
}

