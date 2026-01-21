import { activityLogStore, jobStore, organizationStore, jobApplicationStore } from '../services/firebaseData.service.js';
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
    postingDuration: job.postingDuration || 30,
    scheduledPublishAt: job.scheduledPublishAt || null,
    expiresAt: job.expiresAt || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    applicationsCount: job.applicationsCount || 0, // Include applications count if present
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

      // Get applications count for this job
      const applicationsCount = await jobApplicationStore.countByJob(jobId);
      const jobWithCount = {
        ...sanitizeJob(job),
        applicationsCount,
      };

      res.json({ success: true, job: jobWithCount });
    } catch (error) {
      logger.error('Get job error:', error);
      next(error);
    }
  }

  static async listJobs(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const jobs = await jobStore.listByOrganization(organizationId);
      
      // Enrich jobs with application counts
      const jobsWithCounts = await Promise.all(
        jobs.map(async (job) => {
          const applicationsCount = await jobApplicationStore.countByJob(job.id);
          return {
            ...sanitizeJob(job),
            applicationsCount,
          };
        })
      );
      
      res.json({ success: true, jobs: jobsWithCounts });
    } catch (error) {
      logger.error('List jobs error:', error);
      next(error);
    }
  }

  static async listPublicJobs(req, res, next) {
    try {
      const jobs = await jobStore.listPublished(parseInt(req.query.limit, 10) || 20);
      
      // Enrich jobs with organization info
      const enrichedJobs = await Promise.all(
        jobs.map(async (job) => {
          let organization = null;
          if (job.organizationId) {
            try {
              organization = await organizationStore.getById(job.organizationId);
            } catch (err) {
              logger.warn(`Failed to fetch organization ${job.organizationId} for job ${job.id}:`, err);
            }
          }
          
          return {
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
            compensationRange: job.compensationRange || null,
            salaryCurrency: job.salaryCurrency || null,
            benefits: job.benefits || null,
            publishedAt: job.publishedAt,
            postingDuration: job.postingDuration || 30,
            expiresAt: job.expiresAt || null,
            organizationId: job.organizationId,
            organization: organization ? {
              id: organization.id,
              name: organization.name,
              logo: organization.logo,
              website: organization.website,
              address: organization.address || null,
              description: organization.description || null,
              companySize: organization.companySize || null,
              facebookUrl: organization.facebookUrl || null,
              linkedinUrl: organization.linkedinUrl || null,
              youtubeUrl: organization.youtubeUrl || null,
            } : null,
          };
        })
      );
      
      res.json({ success: true, jobs: enrichedJobs });
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

      // Enrich with organization info
      let organization = null;
      if (job.organizationId) {
        try {
          organization = await organizationStore.getById(job.organizationId);
        } catch (err) {
          logger.warn(`Failed to fetch organization ${job.organizationId} for job ${job.id}:`, err);
        }
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
          compensationRange: job.compensationRange || null,
          salaryCurrency: job.salaryCurrency || null,
          benefits: job.benefits || null,
          publishedAt: job.publishedAt,
          postingDuration: job.postingDuration || 30,
          expiresAt: job.expiresAt || null,
          organizationId: job.organizationId,
          organization: organization ? {
            id: organization.id,
            name: organization.name,
            logo: organization.logo,
            website: organization.website,
            address: organization.address || null,
            description: organization.description || null,
            companySize: organization.companySize || null,
            facebookUrl: organization.facebookUrl || null,
            linkedinUrl: organization.linkedinUrl || null,
            youtubeUrl: organization.youtubeUrl || null,
          } : null,
        },
      });
    } catch (error) {
      logger.error('Get public job error:', error);
      next(error);
    }
  }

  static async deleteJob(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const jobId = req.params.id;

      const existing = await jobStore.getById(jobId);
      if (!existing || existing.organizationId !== organizationId) {
        return res.status(404).json({ error: 'Job not found' });
      }

      await jobStore.delete(jobId);
      await activityLogStore.record({
        organizationId,
        actorId: req.user.id,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'JOB_DELETED',
        targetType: 'JOB',
        targetId: jobId,
        metadata: { title: existing.title },
      });

      res.json({ success: true, message: 'Job deleted successfully' });
    } catch (error) {
      logger.error('Delete job error:', error);
      next(error);
    }
  }
}

