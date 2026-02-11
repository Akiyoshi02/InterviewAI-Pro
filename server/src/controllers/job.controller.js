import {
  activityLogStore,
  jobStore,
  organizationStore,
  jobApplicationStore,
  isJobCurrentlyPublic,
  publishOrganizationRealtimeUpdate,
  publishPublicRealtimeUpdate,
} from '../services/firebaseData.service.js';
import { unlink } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const JOB_ADVERT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const JOB_ADVERT_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const JOB_ADVERT_IMAGE_BASE_PATH = '/uploads/job-advert-images';
const JOB_ADVERT_VIDEO_BASE_PATH = '/uploads/job-advert-videos';
const uploadsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');

const buildUploadUrl = (basePath, filename) => (filename ? `${basePath}/${filename}` : null);

const toLocalUploadPath = (publicUrl) => {
  if (!publicUrl || typeof publicUrl !== 'string') return null;
  const trimmed = publicUrl.trim();
  if (!trimmed.startsWith('/uploads/')) return null;
  const relative = trimmed.replace(/^\/uploads\//, '');
  if (!relative || relative.includes('..')) return null;
  return path.join(uploadsRoot, relative);
};

const cleanupUploadByPublicUrl = async (publicUrl) => {
  const filePath = toLocalUploadPath(publicUrl);
  if (!filePath) return;
  try {
    await unlink(filePath);
  } catch {
    // Ignore cleanup failures.
  }
};

const cleanupUploadedFilePath = async (filePath) => {
  if (!filePath) return;
  try {
    await unlink(filePath);
  } catch {
    // Ignore cleanup failures.
  }
};

const publishJobVisibilityUpdate = async ({ organizationId, previousJob, updatedJob }) => {
  const wasPublic = isJobCurrentlyPublic(previousJob);
  const isPublic = isJobCurrentlyPublic(updatedJob);
  const becamePublic = !wasPublic && isPublic;
  const becameNonPublic = wasPublic && !isPublic;

  if (becamePublic) {
    await publishPublicRealtimeUpdate('jobs', 'job-published', {
      jobId: updatedJob.id,
      organizationId,
      status: updatedJob.status || null,
      publishedAt: updatedJob.publishedAt || null,
    });
    return;
  }

  if (becameNonPublic) {
    await publishPublicRealtimeUpdate('jobs', 'job-deleted', {
      jobId: updatedJob.id,
      organizationId,
      status: updatedJob.status || null,
    });
    return;
  }

  if (!isPublic) {
    return;
  }

  await publishPublicRealtimeUpdate('jobs', 'job-updated', {
    jobId: updatedJob.id,
    organizationId,
    status: updatedJob.status || null,
    publishedAt: updatedJob.publishedAt || null,
  });
};

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
    advertImageUrl: job.advertImageUrl || null,
    advertImageAlt: job.advertImageAlt || null,
    advertVideoUrl: job.advertVideoUrl || null,
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

      await publishOrganizationRealtimeUpdate(organizationId, 'job-created', {
        jobId: job.id,
        status: job.status || null,
      });
      if (isJobCurrentlyPublic(job)) {
        await publishPublicRealtimeUpdate('jobs', 'job-published', {
          jobId: job.id,
          organizationId,
          status: job.status || null,
          publishedAt: job.publishedAt || null,
        });
      }

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

      await publishOrganizationRealtimeUpdate(organizationId, 'job-updated', {
        jobId: updated.id,
        status: updated.status || null,
      });

      await publishJobVisibilityUpdate({
        organizationId,
        previousJob: existing,
        updatedJob: updated,
      });

      if (existing.advertImageUrl && existing.advertImageUrl !== (updated.advertImageUrl || null)) {
        await cleanupUploadByPublicUrl(existing.advertImageUrl);
      }
      if (existing.advertVideoUrl && existing.advertVideoUrl !== (updated.advertVideoUrl || null)) {
        await cleanupUploadByPublicUrl(existing.advertVideoUrl);
      }

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
            advertImageUrl: job.advertImageUrl || null,
            advertImageAlt: job.advertImageAlt || null,
            advertVideoUrl: job.advertVideoUrl || null,
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
      let job = await jobStore.getById(req.params.id);
      if (job?.status === 'PUBLISHED' && job.scheduledPublishAt && !job.publishedAt) {
        await jobStore.autoPublishScheduledJobs();
        job = await jobStore.getById(req.params.id);
      }
      if (!isJobCurrentlyPublic(job)) {
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
          advertImageUrl: job.advertImageUrl || null,
          advertImageAlt: job.advertImageAlt || null,
          advertVideoUrl: job.advertVideoUrl || null,
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

  static async uploadAdvertImage(req, res, next) {
    const file = req.file;
    const uploadedFilePath = file?.path || null;

    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const jobId = req.params.id;

      if (!organizationId) {
        await cleanupUploadedFilePath(uploadedFilePath);
        return res.status(400).json({ error: 'Organization context required' });
      }

      const existing = await jobStore.getById(jobId);
      if (!existing || existing.organizationId !== organizationId) {
        await cleanupUploadedFilePath(uploadedFilePath);
        return res.status(404).json({ error: 'Job not found' });
      }

      if (!file) {
        return res.status(400).json({ error: 'Advert image file is required.' });
      }

      if (file.size > JOB_ADVERT_IMAGE_MAX_BYTES) {
        await cleanupUploadedFilePath(uploadedFilePath);
        return res.status(400).json({ error: 'Advert image must be 8 MB or less.' });
      }

      const nextAdvertImageUrl = buildUploadUrl(JOB_ADVERT_IMAGE_BASE_PATH, file.filename);
      const nextAdvertImageAlt = typeof req.body?.advertImageAlt === 'string'
        ? (req.body.advertImageAlt.trim() || null)
        : (existing.advertImageAlt || null);

      const updated = await jobStore.update(jobId, {
        advertImageUrl: nextAdvertImageUrl,
        advertImageAlt: nextAdvertImageAlt,
      });

      await activityLogStore.record({
        organizationId,
        actorId: req.user.id,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'JOB_UPDATED',
        targetType: 'JOB',
        targetId: updated.id,
        metadata: { title: updated.title, media: 'image' },
      });

      await publishOrganizationRealtimeUpdate(organizationId, 'job-updated', {
        jobId: updated.id,
        status: updated.status || null,
      });

      await publishJobVisibilityUpdate({
        organizationId,
        previousJob: existing,
        updatedJob: updated,
      });

      if (existing.advertImageUrl && existing.advertImageUrl !== nextAdvertImageUrl) {
        await cleanupUploadByPublicUrl(existing.advertImageUrl);
      }

      res.json({ success: true, job: sanitizeJob(updated) });
    } catch (error) {
      await cleanupUploadedFilePath(uploadedFilePath);
      logger.error('Upload job advert image error:', error);
      next(error);
    }
  }

  static async uploadAdvertVideo(req, res, next) {
    const file = req.file;
    const uploadedFilePath = file?.path || null;

    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const jobId = req.params.id;

      if (!organizationId) {
        await cleanupUploadedFilePath(uploadedFilePath);
        return res.status(400).json({ error: 'Organization context required' });
      }

      const existing = await jobStore.getById(jobId);
      if (!existing || existing.organizationId !== organizationId) {
        await cleanupUploadedFilePath(uploadedFilePath);
        return res.status(404).json({ error: 'Job not found' });
      }

      if (!file) {
        return res.status(400).json({ error: 'Advert video file is required.' });
      }

      if (file.size > JOB_ADVERT_VIDEO_MAX_BYTES) {
        await cleanupUploadedFilePath(uploadedFilePath);
        return res.status(400).json({ error: 'Advert video must be 50 MB or less.' });
      }

      const nextAdvertVideoUrl = buildUploadUrl(JOB_ADVERT_VIDEO_BASE_PATH, file.filename);
      const updated = await jobStore.update(jobId, {
        advertVideoUrl: nextAdvertVideoUrl,
      });

      await activityLogStore.record({
        organizationId,
        actorId: req.user.id,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'JOB_UPDATED',
        targetType: 'JOB',
        targetId: updated.id,
        metadata: { title: updated.title, media: 'video' },
      });

      await publishOrganizationRealtimeUpdate(organizationId, 'job-updated', {
        jobId: updated.id,
        status: updated.status || null,
      });

      await publishJobVisibilityUpdate({
        organizationId,
        previousJob: existing,
        updatedJob: updated,
      });

      if (existing.advertVideoUrl && existing.advertVideoUrl !== nextAdvertVideoUrl) {
        await cleanupUploadByPublicUrl(existing.advertVideoUrl);
      }

      res.json({ success: true, job: sanitizeJob(updated) });
    } catch (error) {
      await cleanupUploadedFilePath(uploadedFilePath);
      logger.error('Upload job advert video error:', error);
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

      await cleanupUploadByPublicUrl(existing.advertImageUrl);
      await cleanupUploadByPublicUrl(existing.advertVideoUrl);
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

      await publishOrganizationRealtimeUpdate(organizationId, 'job-deleted', {
        jobId,
      });
      await publishPublicRealtimeUpdate('jobs', 'job-deleted', {
        jobId,
        organizationId,
      });

      res.json({ success: true, message: 'Job deleted successfully' });
    } catch (error) {
      logger.error('Delete job error:', error);
      next(error);
    }
  }
}

