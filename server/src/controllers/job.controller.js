import {
  activityLogStore,
  jobStore,
  organizationStore,
  jobApplicationStore,
  userStore,
  isJobCurrentlyPublic,
  publishOrganizationRealtimeUpdate,
  publishCandidateRealtimeUpdate,
  publishPublicRealtimeUpdate,
} from '../services/firebaseData.service.js';
import { buildJobSnapshot, buildOrganizationSnapshot } from '../utils/applicationSnapshot.util.js';
import {
  appendStatusHistory,
  buildStatusHistoryEntry,
  normalizeDisposition,
} from '../utils/applicationLifecycle.util.js';
import { emailNotifications } from '../services/email.service.js';
import { queueEmailJob } from '../services/backgroundJobQueue.service.js';
import { unlink } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const JOB_ADVERT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const JOB_ADVERT_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const JOB_ADVERT_IMAGE_BASE_PATH = '/uploads/job-advert-images';
const JOB_ADVERT_VIDEO_BASE_PATH = '/uploads/job-advert-videos';
const TERMINAL_APPLICATION_STATUSES = new Set(['REJECTED', 'HIRED']);
const RESOLUTION_REQUIRED_CODE = 'ACTIVE_APPLICATIONS_REQUIRE_RESOLUTION';
const ARCHIVE_REQUIRED_CODE = 'JOB_MUST_BE_ARCHIVED_BEFORE_DELETE';
const uploadsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');

const isApplicationActive = (application) => {
  const status = (application?.status || '').toString().toUpperCase();
  return !TERMINAL_APPLICATION_STATUSES.has(status);
};

const buildJobClosureMessage = (customMessage = '') => {
  const baseMessage = 'This role has been closed and removed, so we are no longer progressing this specific application.';
  const trimmedCustomMessage = typeof customMessage === 'string' ? customMessage.trim() : '';
  if (!trimmedCustomMessage) return baseMessage;
  return `${baseMessage}\n\n${trimmedCustomMessage}`;
};

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

const normalizeAdvertImageUrls = (job) => {
  if (!job) return [];
  if (Array.isArray(job.advertImageUrls)) {
    return job.advertImageUrls
      .map((url) => (typeof url === 'string' ? url.trim() : ''))
      .filter(Boolean);
  }
  if (typeof job.advertImageUrl === 'string' && job.advertImageUrl.trim()) {
    return [job.advertImageUrl.trim()];
  }
  return [];
};

const normalizeWhitespace = (value) => (value == null ? '' : String(value).replace(/\s+/g, ' ').trim());

const humanizeToken = (value) => {
  const cleaned = normalizeWhitespace(value).replaceAll('_', ' ').toLowerCase();
  if (!cleaned) return '';
  return cleaned.replace(/\b\w/g, (character) => character.toUpperCase());
};

const stripMarkup = (value) => normalizeWhitespace(value).replace(/<[^>]*>/g, '').trim();

const truncateText = (value, maxLength = 200) => {
  const normalized = stripMarkup(value);
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
};

const escapeHtml = (value) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const getRequestOrigin = (req) => {
  const forwardedProtoHeader = req.headers['x-forwarded-proto'];
  const forwardedProto = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]
    : typeof forwardedProtoHeader === 'string'
      ? forwardedProtoHeader.split(',')[0]
      : '';
  const forwardedHostHeader = req.headers['x-forwarded-host'];
  const forwardedHost = Array.isArray(forwardedHostHeader)
    ? forwardedHostHeader[0]
    : typeof forwardedHostHeader === 'string'
      ? forwardedHostHeader.split(',')[0]
      : '';

  const protocol = normalizeWhitespace(forwardedProto || req.protocol || 'http').toLowerCase() || 'http';
  const host = normalizeWhitespace(forwardedHost || req.get('host') || '');
  if (!host) {
    return `${protocol}://localhost:${process.env.PORT || 3000}`;
  }
  return `${protocol}://${host}`;
};

const toAbsolutePublicUrl = (value, baseUrl) => {
  const raw = normalizeWhitespace(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  const normalizedBase = normalizeWhitespace(baseUrl).replace(/\/$/, '');
  if (!normalizedBase) return raw;
  return `${normalizedBase}${raw.startsWith('/') ? raw : `/${raw}`}`;
};

const buildShareRoleSnapshot = (job) => [
  normalizeWhitespace(job?.department),
  humanizeToken(job?.employmentType),
  humanizeToken(job?.experienceLevel),
  normalizeWhitespace(job?.location),
].filter(Boolean).join(' | ');

const buildShareMetaDescription = (job) => {
  const roleSnapshot = buildShareRoleSnapshot(job);
  const compensation = normalizeWhitespace(job?.compensationRange || job?.salaryRange || '');
  const overview = truncateText(job?.description, 240);
  return [
    roleSnapshot,
    compensation ? `Compensation: ${compensation}` : '',
    overview,
  ].filter(Boolean).join(' - ');
};

const buildShareHtml = ({
  title,
  description,
  shareUrl,
  jobUrl,
  imageUrl,
  videoUrl,
  organizationName,
}) => {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeShareUrl = escapeHtml(shareUrl);
  const safeJobUrl = escapeHtml(jobUrl);
  const safeImageUrl = escapeHtml(imageUrl);
  const safeVideoUrl = escapeHtml(videoUrl);
  const safeOrganizationName = escapeHtml(organizationName || 'Company');

  const optionalImageTags = imageUrl
    ? `
    <meta property="og:image" content="${safeImageUrl}" />
    <meta property="og:image:alt" content="${safeTitle}" />
    <meta name="twitter:image" content="${safeImageUrl}" />`
    : '';

  const optionalVideoTags = videoUrl
    ? `
    <meta property="og:video" content="${safeVideoUrl}" />
    <meta property="og:video:type" content="video/mp4" />`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />
  <meta name="robots" content="noindex,nofollow,max-image-preview:large" />

  <meta property="og:type" content="website" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:url" content="${safeShareUrl}" />
  <meta property="og:site_name" content="Interviewer" />${optionalImageTags}${optionalVideoTags}

  <meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />

  <link rel="canonical" href="${safeJobUrl}" />
  <meta http-equiv="refresh" content="0;url=${safeJobUrl}" />
  <style>
    :root {
      color-scheme: light dark;
      font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: radial-gradient(circle at top, #e6f4ff, #f6f8fb 48%);
      color: #0f172a;
    }
    .card {
      width: min(640px, 100%);
      border-radius: 16px;
      border: 1px solid #d5e3f8;
      background: #ffffff;
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.12);
      padding: 24px;
    }
    .eyebrow {
      margin: 0 0 8px;
      font-size: 13px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #3366aa;
      font-weight: 600;
    }
    h1 {
      margin: 0 0 12px;
      font-size: 24px;
      line-height: 1.28;
      color: #0b2447;
    }
    p {
      margin: 0 0 18px;
      color: #334155;
      line-height: 1.5;
    }
    a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      padding: 10px 18px;
      background: #0b5fff;
      color: #ffffff;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <main class="card">
    <p class="eyebrow">${safeOrganizationName}</p>
    <h1>${safeTitle}</h1>
    <p>${safeDescription}</p>
    <a href="${safeJobUrl}">View Job</a>
  </main>
  <script>
    window.location.replace(${JSON.stringify(jobUrl)});
  </script>
</body>
</html>`;
};

const normalizeAdvertImagePayload = (payload = {}) => {
  const normalized = { ...payload };
  const hasAdvertImageUrls = Object.prototype.hasOwnProperty.call(normalized, 'advertImageUrls');
  const hasAdvertImageUrl = Object.prototype.hasOwnProperty.call(normalized, 'advertImageUrl');

  if (hasAdvertImageUrls) {
    const sanitizedAdvertImageUrls = Array.isArray(normalized.advertImageUrls)
      ? normalized.advertImageUrls
        .map((url) => (typeof url === 'string' ? url.trim() : ''))
        .filter(Boolean)
      : [];
    normalized.advertImageUrls = sanitizedAdvertImageUrls;
    normalized.advertImageUrl = sanitizedAdvertImageUrls[0] || null;
    return normalized;
  }

  if (hasAdvertImageUrl) {
    const sanitizedAdvertImageUrl = typeof normalized.advertImageUrl === 'string'
      ? normalized.advertImageUrl.trim()
      : '';
    normalized.advertImageUrl = sanitizedAdvertImageUrl || null;
    normalized.advertImageUrls = sanitizedAdvertImageUrl ? [sanitizedAdvertImageUrl] : [];
  }

  return normalized;
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

const normalizeApplicationQuestions = (job) => {
  const rawQuestions = Array.isArray(job?.applicationQuestions) && job.applicationQuestions.length > 0
    ? job.applicationQuestions
    : (Array.isArray(job?.customFormFields) ? job.customFormFields : []);

  return rawQuestions
    .map((rawQuestion, index) => {
      const question = rawQuestion && typeof rawQuestion === 'object'
        ? rawQuestion
        : { question: rawQuestion };
      const id = (question.id || `question_${index + 1}`).toString().trim() || `question_${index + 1}`;
      const prompt = (question.question || question.label || '').toString().trim();
      const type = (question.type || 'TEXT').toString().trim().toUpperCase();
      return {
        id,
        question: prompt,
        type: type || 'TEXT',
        required: Boolean(question.required),
        options: Array.isArray(question.options)
          ? question.options
            .map((option) => (option || '').toString().trim())
            .filter(Boolean)
          : [],
        placeholder: (question.placeholder || '').toString().trim() || null,
      };
    })
    .filter((question) => question.question);
};

const normalizeCustomFormFields = (job) => {
  const rawFields = Array.isArray(job?.customFormFields) && job.customFormFields.length > 0
    ? job.customFormFields
    : normalizeApplicationQuestions(job).map((question) => ({
      id: question.id,
      label: question.question,
      type: (question.type || 'TEXT').toString().trim().toLowerCase(),
      required: Boolean(question.required),
      options: Array.isArray(question.options) ? question.options : [],
      placeholder: question.placeholder || '',
    }));

  return rawFields
    .map((rawField, index) => {
      const field = rawField && typeof rawField === 'object'
        ? rawField
        : { label: rawField };
      const id = (field.id || `field_${index + 1}`).toString().trim() || `field_${index + 1}`;
      const label = (field.label || field.question || '').toString().trim();
      return {
        id,
        label,
        type: (field.type || 'text').toString().trim().toLowerCase() || 'text',
        required: Boolean(field.required),
        options: Array.isArray(field.options)
          ? field.options
            .map((option) => (option || '').toString().trim())
            .filter(Boolean)
          : [],
        placeholder: (field.placeholder || '').toString().trim() || '',
      };
    })
    .filter((field) => field.label);
};

const sanitizeJob = (job) => {
  if (!job) return null;
  const advertImageUrls = normalizeAdvertImageUrls(job);
  const applicationQuestions = normalizeApplicationQuestions(job);
  const customFormFields = normalizeCustomFormFields(job);
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
    advertImageUrls,
    advertImageUrl: advertImageUrls[0] || null,
    advertImageAlt: job.advertImageAlt || null,
    advertVideoUrl: job.advertVideoUrl || null,
    status: job.status,
    stages: job.stages || [],
    applicationQuestions,
    customFormFields,
    templateConfig: job.templateConfig || {},
    publishedAt: job.publishedAt,
    postingDuration: job.postingDuration || 30,
    scheduledPublishAt: job.scheduledPublishAt || null,
    expiresAt: job.expiresAt || null,
    deletedAt: job.deletedAt || null,
    deletedBy: job.deletedBy || null,
    deletionMode: job.deletionMode || null,
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
        ...normalizeAdvertImagePayload(req.body),
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

      const updated = await jobStore.update(jobId, normalizeAdvertImagePayload(req.body));
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

      const previousAdvertImageUrls = normalizeAdvertImageUrls(existing);
      const nextAdvertImageUrls = normalizeAdvertImageUrls(updated);
      const removedAdvertImageUrls = previousAdvertImageUrls.filter(
        (imageUrl) => !nextAdvertImageUrls.includes(imageUrl),
      );
      for (const removedImageUrl of removedAdvertImageUrls) {
        await cleanupUploadByPublicUrl(removedImageUrl);
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

      const countsByJobId = await jobApplicationStore.countByJobIds(jobs.map((job) => job.id));
      const jobsWithCounts = jobs.map((job) => ({
        ...sanitizeJob(job),
        applicationsCount: countsByJobId.get(job.id) || 0,
      }));

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
          
          const advertImageUrls = normalizeAdvertImageUrls(job);
          const applicationQuestions = normalizeApplicationQuestions(job);
          const customFormFields = normalizeCustomFormFields(job);
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
            applicationQuestions,
            customFormFields,
            advertImageUrls,
            advertImageUrl: advertImageUrls[0] || null,
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

      const advertImageUrls = normalizeAdvertImageUrls(job);
      const applicationQuestions = normalizeApplicationQuestions(job);
      const customFormFields = normalizeCustomFormFields(job);
      res.json({
        success: true,
        job: {
          advertImageUrls,
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
          applicationQuestions,
          customFormFields,
          advertImageUrl: advertImageUrls[0] || null,
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

  static async getPublicJobSharePage(req, res, next) {
    try {
      let job = await jobStore.getById(req.params.id);
      if (job?.status === 'PUBLISHED' && job.scheduledPublishAt && !job.publishedAt) {
        await jobStore.autoPublishScheduledJobs();
        job = await jobStore.getById(req.params.id);
      }
      if (!isJobCurrentlyPublic(job)) {
        return res.status(404).send('Job not found');
      }

      let organization = null;
      if (job.organizationId) {
        try {
          organization = await organizationStore.getById(job.organizationId);
        } catch (err) {
          logger.warn(`Failed to fetch organization ${job.organizationId} for shared job ${job.id}:`, err);
        }
      }

      const requestOrigin = getRequestOrigin(req).replace(/\/$/, '');
      const apiBaseUrl = normalizeWhitespace(process.env.PUBLIC_API_URL || requestOrigin).replace(/\/$/, '');
      const frontendBaseUrl = normalizeWhitespace(process.env.FRONTEND_URL || requestOrigin).replace(/\/$/, '');
      const encodedJobId = encodeURIComponent(job.id);

      const shareUrl = `${apiBaseUrl}/api/public/jobs/${encodedJobId}/share`;
      const jobUrl = `${frontendBaseUrl}/jobs/${encodedJobId}`;
      const advertImageUrls = normalizeAdvertImageUrls(job);
      const imageUrl = toAbsolutePublicUrl(
        advertImageUrls[0] || organization?.logo || '',
        apiBaseUrl || requestOrigin,
      );
      const videoUrl = toAbsolutePublicUrl(job.advertVideoUrl || '', apiBaseUrl || requestOrigin);
      const title = `${normalizeWhitespace(job.title) || 'Job Opportunity'} | ${normalizeWhitespace(organization?.name || 'Company')}`;
      const description = buildShareMetaDescription(job) || 'Explore this opportunity and apply now.';

      const html = buildShareHtml({
        title,
        description,
        shareUrl,
        jobUrl,
        imageUrl,
        videoUrl,
        organizationName: organization?.name || 'Company',
      });

      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=300');
      res.status(200).send(html);
    } catch (error) {
      logger.error('Get public job share page error:', error);
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
      const nextAdvertImageUrls = Array.from(
        new Set([...normalizeAdvertImageUrls(existing), nextAdvertImageUrl].filter(Boolean)),
      );

      const updated = await jobStore.update(jobId, {
        advertImageUrls: nextAdvertImageUrls,
        advertImageUrl: nextAdvertImageUrls[0] || null,
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
      const resolveActiveApplications = req.body?.resolveActiveApplications === true;
      const notifyCandidates = req.body?.notifyCandidates !== false;
      const resolutionMessage = typeof req.body?.resolutionMessage === 'string'
        ? req.body.resolutionMessage.trim()
        : '';

      const existing = await jobStore.getById(jobId);
      if (!existing || existing.organizationId !== organizationId) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const jobStatus = (existing.status || '').toString().toUpperCase();
      if (jobStatus !== 'ARCHIVED' && jobStatus !== 'DRAFT') {
        return res.status(409).json({
          error: 'Archive this job before deleting it.',
          code: ARCHIVE_REQUIRED_CODE,
          details: {
            currentStatus: jobStatus || 'UNKNOWN',
            requiredAction: 'Set job status to ARCHIVED before deleting.',
          },
        });
      }

      const [applications, organization] = await Promise.all([
        jobApplicationStore.listByJob(jobId),
        organizationStore.getById(organizationId).catch((organizationError) => {
          logger.warn(`Unable to fetch organization ${organizationId} for delete snapshot:`, organizationError);
          return null;
        }),
      ]);
      const activeApplications = applications.filter(isApplicationActive);

      if (activeApplications.length > 0 && !resolveActiveApplications) {
        return res.status(409).json({
          error: 'This job has active applications. Resolve them before deleting.',
          code: RESOLUTION_REQUIRED_CODE,
          details: {
            totalApplications: applications.length,
            activeApplications: activeApplications.length,
            requiredAction: 'Set resolveActiveApplications=true to auto-reject active applications before deletion.',
          },
        });
      }

      let resolvedApplicationsCount = 0;
      let notifiedCandidatesCount = 0;
      let notificationFailures = 0;
      const deletedAt = new Date().toISOString();
      const fallbackJobSnapshot = buildJobSnapshot(existing);
      const fallbackOrganizationSnapshot = buildOrganizationSnapshot(organization, organizationId);
      const candidateIds = [...new Set(activeApplications.map((application) => application.candidateId).filter(Boolean))];
      const candidateMap = candidateIds.length > 0 ? await userStore.getSummaries(candidateIds) : new Map();
      const closureMessage = buildJobClosureMessage(resolutionMessage);
      const closureDisposition = normalizeDisposition({
        dispositionCode: 'JOB_CLOSED',
        dispositionReason: 'This role was closed before the application process was completed.',
        dispositionNotes: resolutionMessage || null,
      }, {
        status: 'REJECTED',
        jobDeletedAt: deletedAt,
        fallbackCode: 'JOB_CLOSED',
      });

      if (applications.length > 0) {
        for (const application of applications) {
          const currentJobSnapshot = application?.jobSnapshot && typeof application.jobSnapshot === 'object'
            ? application.jobSnapshot
            : null;
          const currentOrganizationSnapshot = application?.organizationSnapshot && typeof application.organizationSnapshot === 'object'
            ? application.organizationSnapshot
            : null;
          const shouldResolveStatus = resolveActiveApplications && isApplicationActive(application);
          const nextStatus = shouldResolveStatus ? 'REJECTED' : application.status;
          const statusHistoryEntry = shouldResolveStatus
            ? buildStatusHistoryEntry({
              previousStatus: application.status,
              status: nextStatus,
              changedAt: deletedAt,
              changedBy: req.user.id,
              source: 'JOB_CLOSURE_AUTOMATION',
              note: closureDisposition.notes || closureDisposition.reason || null,
              dispositionCode: closureDisposition.code,
              dispositionCategory: closureDisposition.category,
            })
            : null;

          const updatedApplication = await jobApplicationStore.update(application.id, {
            jobSnapshot: currentJobSnapshot || fallbackJobSnapshot,
            organizationSnapshot: currentOrganizationSnapshot || fallbackOrganizationSnapshot,
            jobDeletedAt: deletedAt,
            ...(shouldResolveStatus
              ? {
                status: nextStatus,
                reviewedAt: deletedAt,
                reviewedBy: req.user.id,
                statusSource: 'JOB_CLOSURE_AUTOMATION',
                statusChangedAt: deletedAt,
                dispositionCode: closureDisposition.code,
                dispositionCategory: closureDisposition.category,
                dispositionReason: closureDisposition.reason,
                dispositionNotes: closureDisposition.notes,
                dispositionTags: closureDisposition.tags,
                dispositionAt: deletedAt,
                dispositionBy: req.user.id,
                statusHistory: appendStatusHistory(application.statusHistory, statusHistoryEntry),
              }
              : {}),
          });

          if (!shouldResolveStatus) {
            continue;
          }

          resolvedApplicationsCount++;

          await publishOrganizationRealtimeUpdate(organizationId, 'application-status-updated', {
            applicationId: updatedApplication.id,
            jobId: updatedApplication.jobId || jobId,
            candidateId: updatedApplication.candidateId || null,
            status: nextStatus,
          });
          await publishCandidateRealtimeUpdate(updatedApplication.candidateId, 'application-status-updated', {
            applicationId: updatedApplication.id,
            jobId: updatedApplication.jobId || jobId,
            organizationId,
            status: nextStatus,
          });

          if (!notifyCandidates) {
            continue;
          }

          const candidate = candidateMap.get(updatedApplication.candidateId);
          if (!candidate?.email) {
            continue;
          }

          const queuedJobId = queueEmailJob({
            type: 'JOB_CLOSED_CANDIDATE_NOTIFICATION',
            payload: {
              applicationId: updatedApplication.id,
              jobId,
              candidateId: updatedApplication.candidateId,
              recipient: candidate.email,
            },
            handler: async () => {
              await emailNotifications.sendApplicationStatusUpdated(
                updatedApplication,
                candidate,
                existing,
                organization || { id: organizationId, name: 'Company' },
                closureMessage,
              );
            },
          });
          if (queuedJobId) {
            notifiedCandidatesCount++;
          } else {
            notificationFailures++;
            logger.error(`Failed to queue candidate closure email for ${candidate.email} and job ${jobId}.`);
          }
        }
      }

      for (const imageUrl of normalizeAdvertImageUrls(existing)) {
        await cleanupUploadByPublicUrl(imageUrl);
      }
      await cleanupUploadByPublicUrl(existing.advertVideoUrl);
      const deletedJob = await jobStore.delete(jobId, {
        deletedAt,
        deletedBy: req.user.id,
        deleteReason: `ATS_SOFT_DELETE:${resolveActiveApplications ? 'RESOLVED_ACTIVE_APPLICATIONS' : 'NO_ACTIVE_APPLICATIONS'}`,
      });
      await activityLogStore.record({
        organizationId,
        actorId: req.user.id,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'JOB_DELETED',
        targetType: 'JOB',
        targetId: jobId,
        metadata: {
          title: existing.title,
          deletionMode: deletedJob?.deletionMode || 'SOFT',
          resolvedApplicationsCount,
          notifiedCandidatesCount,
          notificationFailures,
        },
      });

      await publishOrganizationRealtimeUpdate(organizationId, 'job-deleted', {
        jobId,
      });
      await publishPublicRealtimeUpdate('jobs', 'job-deleted', {
        jobId,
        organizationId,
      });

      res.json({
        success: true,
        message: 'Job removed from active ATS lists successfully',
        deletionMode: deletedJob?.deletionMode || 'SOFT',
        resolvedApplicationsCount,
        notifiedCandidatesCount,
        notificationFailures,
      });
    } catch (error) {
      logger.error('Delete job error:', error);
      next(error);
    }
  }
}

