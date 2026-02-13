import {
  jobApplicationStore,
  jobStore,
  userStore,
  activityLogStore,
  organizationStore,
  isJobCurrentlyPublic,
  publishOrganizationRealtimeUpdate,
  publishCandidateRealtimeUpdate,
} from '../services/firebaseData.service.js';
import { emailNotifications } from '../services/email.service.js';
import { queueEmailJob } from '../services/backgroundJobQueue.service.js';
import { buildJobSnapshot, buildOrganizationSnapshot } from '../utils/applicationSnapshot.util.js';
import {
  APPLICATION_STATUSES,
  appendStatusHistory,
  canTransitionApplicationStatus,
  buildStatusHistoryEntry,
  getAllowedApplicationTransitions,
  isTerminalApplicationStatus,
  normalizeApplicationStatus,
  normalizeDisposition,
} from '../utils/applicationLifecycle.util.js';
import logger from '../utils/logger.js';

const STATUS_TRANSITION_ERROR_CODE = 'INVALID_APPLICATION_STATUS_TRANSITION';

const parseOptionalStatus = (value) => {
  if (!value) return null;
  return normalizeApplicationStatus(value);
};

const parseOptionalLimit = (value) => {
  if (value == null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
};

const buildApplicationJobPayload = (application, liveJob = null) => {
  const snapshot = application?.jobSnapshot && typeof application.jobSnapshot === 'object'
    ? application.jobSnapshot
    : null;
  const hasDeletionMarker = Boolean(
    application?.jobDeletedAt || (!liveJob && application?.jobId),
  );
  const source = liveJob || snapshot;
  const isDeleted = !liveJob && hasDeletionMarker;

  if (!source && !application?.jobId && !hasDeletionMarker) {
    return null;
  }

  return {
    id: source?.id || application?.jobId || null,
    title: source?.title || (isDeleted ? 'Deleted Position' : null),
    department: source?.department || null,
    location: source?.location || null,
    employmentType: source?.employmentType || null,
    experienceLevel: source?.experienceLevel || null,
    skills: Array.isArray(source?.skills) ? source.skills : [],
    isDeleted,
    deletedAt: application?.jobDeletedAt || null,
  };
};

const buildApplicationOrganizationPayload = (application, liveOrganization = null) => {
  const snapshot = application?.organizationSnapshot && typeof application.organizationSnapshot === 'object'
    ? application.organizationSnapshot
    : null;
  const source = liveOrganization || snapshot;

  if (!source && !application?.organizationId) {
    return null;
  }

  return {
    id: source?.id || application.organizationId || null,
    name: source?.name || source?.displayName || 'Company',
    logo: source?.logo || null,
    website: source?.website || null,
  };
};

const sanitizeApplication = (application, candidate = null, job = null, organization = null) => {
  if (!application) return null;
  const hasDeletedJobContext = Boolean(
    application.jobDeletedAt || (!job && application.jobId),
  );
  const latestHistory = Array.isArray(application.statusHistory)
    ? application.statusHistory.slice(-20)
    : [];
  const disposition = normalizeDisposition(application, {
    status: application.status,
    withdrawnBy: application.withdrawnBy || null,
    jobDeletedAt: hasDeletedJobContext ? (application.jobDeletedAt || 'LEGACY_ORPHAN_JOB') : null,
    fallbackCode: application.dispositionCode || null,
    fallbackReason: application.dispositionReason || null,
  });

  return {
    id: application.id,
    jobId: application.jobId,
    candidateId: application.candidateId,
    organizationId: application.organizationId,
    status: application.status,
    resumeUrl: application.resumeUrl,
    coverLetter: application.coverLetter,
    answers: application.answers || [],
    submittedAt: application.submittedAt || application.createdAt, // Fallback to createdAt for backward compatibility
    reviewedAt: application.reviewedAt,
    reviewedBy: application.reviewedBy,
    withdrawnBy: application.withdrawnBy || null, // Track if withdrawn by candidate
    statusSource: application.statusSource || null,
    statusChangedAt: application.statusChangedAt || application.reviewedAt || application.updatedAt || null,
    dispositionCode: disposition.code,
    dispositionCategory: disposition.category,
    dispositionReason: disposition.reason,
    dispositionNotes: disposition.notes,
    dispositionTags: disposition.tags,
    dispositionAt: application.dispositionAt || null,
    dispositionBy: application.dispositionBy || null,
    statusHistory: latestHistory,
    interviewId: application.interviewId,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    candidate,
    job: buildApplicationJobPayload(application, job),
    organization: buildApplicationOrganizationPayload(application, organization),
  };
};

export class ApplicationController {
  /**
   * Submit a job application
   */
  static async submitApplication(req, res, next) {
    try {
      const { jobId } = req.params;
      const { resumeUrl, coverLetter, answers } = req.body;
      const candidateId = req.user.id;
      let organization = null;

      // Get the job
      let job = await jobStore.getById(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Ensure scheduled jobs are promoted before evaluating application eligibility.
      if (job.status === 'PUBLISHED' && job.scheduledPublishAt && !job.publishedAt) {
        await jobStore.autoPublishScheduledJobs();
        job = await jobStore.getById(jobId);
      }

      // Check if job is publicly live and accepting applications.
      if (!isJobCurrentlyPublic(job)) {
        return res.status(400).json({ error: 'This job is not currently accepting applications' });
      }

      if (job.acceptingApplications === false) {
        return res.status(400).json({ error: 'Applications are closed for this position' });
      }

      // Check for duplicate application (excluding withdrawn applications)
      const existingApplication = await jobApplicationStore.checkDuplicate(jobId, candidateId);
      if (existingApplication) {
        // Allow re-applying if the previous application was withdrawn by the candidate
        const isWithdrawn = existingApplication.status === 'REJECTED' && existingApplication.withdrawnBy;
        
        if (!isWithdrawn) {
          // Only block if it's not a withdrawn application
          return res.status(409).json({
            error: 'You have already applied to this position',
            application: sanitizeApplication(existingApplication, null, null, null),
          });
        }
        // If withdrawn, we'll allow creating a new application below
      }

      // Validate answers match questions
      if (job.applicationQuestions && job.applicationQuestions.length > 0) {
        const requiredQuestions = job.applicationQuestions.filter((q) => q.required);
        const answeredQuestionIds = new Set((answers || []).map((a) => a.questionId));
        
        for (const question of requiredQuestions) {
          if (!answeredQuestionIds.has(question.id)) {
            return res.status(400).json({
              error: `Missing required answer for: ${question.question}`,
            });
          }
        }
      }

      // Create application
      try {
        organization = await organizationStore.getById(job.organizationId);
      } catch (organizationError) {
        logger.warn(`Unable to fetch organization ${job.organizationId} for application snapshot:`, organizationError);
      }

      const application = await jobApplicationStore.create({
        jobId,
        candidateId,
        organizationId: job.organizationId,
        status: 'SUBMITTED',
        resumeUrl: resumeUrl || req.user.profile?.resumeUrl,
        coverLetter: coverLetter || null,
        answers: answers || [],
        jobSnapshot: buildJobSnapshot(job),
        organizationSnapshot: buildOrganizationSnapshot(organization, job.organizationId),
        statusSource: 'CANDIDATE_SUBMISSION',
        statusChangedAt: new Date().toISOString(),
        statusHistory: [
          buildStatusHistoryEntry({
            previousStatus: null,
            status: 'SUBMITTED',
            changedBy: candidateId,
            source: 'CANDIDATE_SUBMISSION',
          }),
        ],
      });

      // Log activity
      await activityLogStore.record({
        organizationId: job.organizationId,
        actorId: candidateId,
        actorRole: null,
        action: 'APPLICATION_SUBMITTED',
        targetType: 'APPLICATION',
        targetId: application.id,
        metadata: {
          jobId,
          jobTitle: job.title,
        },
      });

      logger.info(`Application submitted: ${application.id} for job ${jobId} by candidate ${candidateId}`);

      await publishOrganizationRealtimeUpdate(job.organizationId, 'application-submitted', {
        applicationId: application.id,
        jobId,
        candidateId,
        status: application.status || null,
      });
      await publishCandidateRealtimeUpdate(candidateId, 'application-submitted', {
        applicationId: application.id,
        jobId,
        organizationId: job.organizationId,
        status: application.status || null,
      });

      // Send confirmation email in background.
      if (!organization) {
        organization = await organizationStore.getById(job.organizationId).catch(() => null);
      }
      if (organization && req.user?.email) {
        queueEmailJob({
          type: 'APPLICATION_RECEIVED',
          payload: {
            applicationId: application.id,
            candidateId,
            recipient: req.user.email,
          },
          handler: async () => {
            await emailNotifications.sendApplicationReceived(application, req.user, job, organization);
            logger.info(`Application confirmation email sent to ${req.user.email}`);
          },
        });
      }

      res.status(201).json({
        success: true,
        application: sanitizeApplication(application, null, job, organization),
        message: 'Application submitted successfully',
      });
    } catch (error) {
      logger.error('Submit application error:', error);
      next(error);
    }
  }

  /**
   * Get candidate's applications
   */
  static async getCandidateApplications(req, res, next) {
    try {
      const candidateId = req.user.id;
      const requestedStatus = parseOptionalStatus(req.query.status);
      const requestedLimit = parseOptionalLimit(req.query.limit);
      const requestedCursor = req.query.cursor ? String(req.query.cursor).trim() : null;

      let applications = [];
      let page = null;
      if (requestedLimit || requestedCursor) {
        page = await jobApplicationStore.listByCandidatePage(candidateId, {
          status: requestedStatus,
          limit: requestedLimit || 50,
          cursor: requestedCursor,
        });
        applications = page.items;
      } else {
        applications = await jobApplicationStore.listByCandidate(candidateId);
        if (requestedStatus) {
          applications = applications.filter(
            (application) => normalizeApplicationStatus(application?.status) === requestedStatus,
          );
        }
      }

      // Enrich with job and organization details
      const jobIds = applications.map((app) => app.jobId).filter(Boolean);
      const organizationIds = [...new Set(applications.map((app) => app.organizationId).filter(Boolean))];
      
      const [jobs, organizations] = await Promise.all([
        Promise.all(jobIds.map((id) => jobStore.getById(id))),
        Promise.all(organizationIds.map((id) => organizationStore.getById(id))),
      ]);
      
      const jobMap = new Map(jobs.filter(Boolean).map((job) => [job.id, job]));
      const orgMap = new Map(organizations.filter(Boolean).map((org) => [org.id, org]));

      const enriched = applications.map((app) =>
        sanitizeApplication(app, null, jobMap.get(app.jobId), orgMap.get(app.organizationId)),
      );

      res.json({
        success: true,
        applications: enriched,
        pagination: page
          ? {
            limit: requestedLimit || 50,
            nextCursor: page.nextCursor || null,
            hasMore: page.hasMore === true,
          }
          : null,
      });
    } catch (error) {
      logger.error('Get candidate applications error:', error);
      next(error);
    }
  }

  /**
   * Get application by ID
   */
  static async getApplication(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const accountType = req.user.accountType;
      const organizationId = req.user.organizationContext?.organization?.id;

      const application = await jobApplicationStore.getById(id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Check access
      const isCandidate = accountType === 'CANDIDATE' && application.candidateId === userId;
      const isRecruiter = accountType === 'COMPANY' && application.organizationId === organizationId;

      if (!isCandidate && !isRecruiter) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get job, candidate, and organization details
      const [job, candidate, organization] = await Promise.all([
        jobStore.getById(application.jobId),
        userStore.getSummary(application.candidateId),
        organizationStore.getById(application.organizationId),
      ]);

      res.json({
        success: true,
        application: sanitizeApplication(application, candidate, job, organization),
      });
    } catch (error) {
      logger.error('Get application error:', error);
      next(error);
    }
  }

  /**
   * Get applications for a job (recruiter)
   */
  static async getJobApplications(req, res, next) {
    try {
      const { jobId } = req.params;
      const organizationId = req.user.organizationContext?.organization?.id;
      const requestedStatus = parseOptionalStatus(req.query.status);
      const requestedLimit = parseOptionalLimit(req.query.limit);
      const requestedCursor = req.query.cursor ? String(req.query.cursor).trim() : null;

      // Verify job belongs to organization
      const job = await jobStore.getById(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      let applications = [];
      let page = null;
      if (requestedLimit || requestedCursor) {
        page = await jobApplicationStore.listByJobPage(jobId, {
          status: requestedStatus,
          limit: requestedLimit || 50,
          cursor: requestedCursor,
        });
        applications = page.items;
      } else {
        applications = await jobApplicationStore.listByJob(jobId);
        if (requestedStatus) {
          applications = applications.filter(
            (application) => normalizeApplicationStatus(application?.status) === requestedStatus,
          );
        }
      }

      // Enrich with candidate details
      const candidateIds = applications.map((app) => app.candidateId).filter(Boolean);
      const candidates = await userStore.getSummaries(candidateIds);

      const enriched = applications.map((app) =>
        sanitizeApplication(app, candidates.get(app.candidateId), job, null),
      );

      res.json({
        success: true,
        applications: enriched,
        job: {
          id: job.id,
          title: job.title,
          department: job.department,
        },
        pagination: page
          ? {
            limit: requestedLimit || 50,
            nextCursor: page.nextCursor || null,
            hasMore: page.hasMore === true,
          }
          : null,
      });
    } catch (error) {
      logger.error('Get job applications error:', error);
      next(error);
    }
  }

  /**
   * Update application status (recruiter)
   */
  static async updateApplicationStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.id;
      const organizationId = req.user.organizationContext?.organization?.id;

      const application = await jobApplicationStore.getById(id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Verify application belongs to organization
      if (application.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const nextStatus = normalizeApplicationStatus(status);
      const previousStatus = normalizeApplicationStatus(application.status);
      if (!nextStatus) {
        return res.status(400).json({
          error: 'Invalid status value',
          details: { allowedStatuses: APPLICATION_STATUSES },
        });
      }
      if (!canTransitionApplicationStatus(previousStatus, nextStatus, { allowNoop: true })) {
        return res.status(409).json({
          error: `Cannot change application status from ${previousStatus || 'UNKNOWN'} to ${nextStatus}`,
          code: STATUS_TRANSITION_ERROR_CODE,
          details: {
            applicationId: id,
            currentStatus: previousStatus,
            requestedStatus: nextStatus,
            allowedNextStatuses: getAllowedApplicationTransitions(previousStatus),
            isTerminal: isTerminalApplicationStatus(previousStatus),
          },
        });
      }

      const statusChangedAt = new Date().toISOString();
      const disposition = normalizeDisposition(req.body, {
        status: nextStatus,
        withdrawnBy: null,
        jobDeletedAt: null,
      });
      const isFinalDecision = nextStatus === 'REJECTED' || nextStatus === 'HIRED';
      const statusHistoryEntry = buildStatusHistoryEntry({
        previousStatus,
        status: nextStatus,
        changedAt: statusChangedAt,
        changedBy: userId,
        source: 'RECRUITER_MANUAL',
        note: disposition.notes || disposition.reason || null,
        dispositionCode: disposition.code,
        dispositionCategory: disposition.category,
      });

      const updated = await jobApplicationStore.update(id, {
        status: nextStatus,
        reviewedAt: statusChangedAt,
        reviewedBy: userId,
        statusSource: 'RECRUITER_MANUAL',
        statusChangedAt,
        ...(isFinalDecision
          ? {
            dispositionCode: disposition.code,
            dispositionCategory: disposition.category,
            dispositionReason: disposition.reason,
            dispositionNotes: disposition.notes,
            dispositionTags: disposition.tags,
            dispositionAt: statusChangedAt,
            dispositionBy: userId,
          }
          : {
            dispositionCode: null,
            dispositionCategory: null,
            dispositionReason: null,
            dispositionNotes: null,
            dispositionTags: [],
            dispositionAt: null,
            dispositionBy: null,
          }),
        statusHistory: appendStatusHistory(application.statusHistory, statusHistoryEntry),
      });

      // Log activity
      await activityLogStore.record({
        organizationId,
        actorId: userId,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'APPLICATION_STATUS_UPDATED',
        targetType: 'APPLICATION',
        targetId: id,
        metadata: {
          status: nextStatus,
          jobId: application.jobId,
          dispositionCode: disposition.code || null,
          dispositionCategory: disposition.category || null,
        },
      });

      logger.info(`Application ${id} status updated to ${nextStatus} by ${userId}`);

      await publishOrganizationRealtimeUpdate(organizationId, 'application-status-updated', {
        applicationId: id,
        jobId: application.jobId || null,
        candidateId: application.candidateId || null,
        status: updated.status || status,
      });
      await publishCandidateRealtimeUpdate(application.candidateId, 'application-status-updated', {
        applicationId: id,
        jobId: application.jobId || null,
        organizationId,
        status: updated.status || status,
      });

      // Send status update email in background.
      const [candidate, job, organization] = await Promise.all([
        userStore.getSummary(application.candidateId),
        jobStore.getById(application.jobId),
        organizationStore.getById(organizationId),
      ]);
      if (candidate?.email && job && organization) {
        queueEmailJob({
          type: 'APPLICATION_STATUS_UPDATED',
          payload: {
            applicationId: updated.id,
            candidateId: application.candidateId,
            recipient: candidate.email || null,
            status: updated.status,
          },
          handler: async () => {
            await emailNotifications.sendApplicationStatusUpdated(updated, candidate, job, organization);
            logger.info(`Status update email sent to ${candidate.email}`);
          },
        });
      }

      res.json({
        success: true,
        application: sanitizeApplication(updated, null, null, null),
      });
    } catch (error) {
      logger.error('Update application status error:', error);
      next(error);
    }
  }

  /**
   * Withdraw application (candidate)
   */
  static async withdrawApplication(req, res, next) {
    try {
      const { id } = req.params;
      const candidateId = req.user.id;

      const application = await jobApplicationStore.getById(id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Verify ownership
      if (application.candidateId !== candidateId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Can't withdraw if already hired or in interview
      if (['HIRED', 'INTERVIEWING'].includes(application.status)) {
        return res.status(400).json({
          error: 'Cannot withdraw application at this stage. Please contact the employer.',
        });
      }
      if (normalizeApplicationStatus(application.status) === 'REJECTED') {
        return res.status(409).json({
          error: 'Application is already closed.',
          code: STATUS_TRANSITION_ERROR_CODE,
          details: {
            currentStatus: normalizeApplicationStatus(application.status),
            requestedStatus: 'REJECTED',
            allowedNextStatuses: getAllowedApplicationTransitions(application.status),
          },
        });
      }

      const withdrawnAt = new Date().toISOString();

      const updated = await jobApplicationStore.update(id, {
        status: 'REJECTED',
        withdrawnBy: candidateId, // Track that this was withdrawn by the candidate
        reviewedAt: withdrawnAt,
        reviewedBy: candidateId,
        statusSource: 'CANDIDATE_WITHDRAWAL',
        statusChangedAt: withdrawnAt,
        dispositionCode: 'CANDIDATE_WITHDREW',
        dispositionCategory: 'CANDIDATE_ACTION',
        dispositionReason: 'Application withdrawn by candidate.',
        dispositionNotes: null,
        dispositionTags: [],
        dispositionAt: withdrawnAt,
        dispositionBy: candidateId,
        statusHistory: appendStatusHistory(
          application.statusHistory,
          buildStatusHistoryEntry({
            previousStatus: application.status,
            status: 'REJECTED',
            changedAt: withdrawnAt,
            changedBy: candidateId,
            source: 'CANDIDATE_WITHDRAWAL',
            note: 'Candidate withdrew application.',
            dispositionCode: 'CANDIDATE_WITHDREW',
            dispositionCategory: 'CANDIDATE_ACTION',
          }),
        ),
      });

      logger.info(`Application ${id} withdrawn by candidate ${candidateId}`);

      await publishOrganizationRealtimeUpdate(application.organizationId, 'application-withdrawn', {
        applicationId: id,
        jobId: application.jobId || null,
        candidateId,
        status: updated.status || 'REJECTED',
      });
      await publishCandidateRealtimeUpdate(candidateId, 'application-withdrawn', {
        applicationId: id,
        jobId: application.jobId || null,
        organizationId: application.organizationId || null,
        status: updated.status || 'REJECTED',
      });

      res.json({
        success: true,
        application: sanitizeApplication(updated),
        message: 'Application withdrawn successfully',
      });
    } catch (error) {
      logger.error('Withdraw application error:', error);
      next(error);
    }
  }

  /**
   * Get all applications for organization (recruiter dashboard)
   */
  static async getOrganizationApplications(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const requestedStatus = parseOptionalStatus(req.query.status);
      const requestedLimit = parseOptionalLimit(req.query.limit) || 50;
      const requestedCursor = req.query.cursor ? String(req.query.cursor).trim() : null;
      const usingPagination = Boolean(requestedCursor || req.query.limit);

      let applications = [];
      let page = null;
      if (usingPagination) {
        page = await jobApplicationStore.listByOrganizationPage(organizationId, {
          status: requestedStatus,
          limit: requestedLimit,
          cursor: requestedCursor,
        });
        applications = page.items;
      } else {
        applications = await jobApplicationStore.listByOrganization(organizationId, requestedLimit);
        if (requestedStatus) {
          applications = applications.filter(
            (app) => normalizeApplicationStatus(app?.status) === requestedStatus,
          );
        }
      }

      // Enrich with candidate, job, and organization details
      const candidateIds = applications.map((app) => app.candidateId).filter(Boolean);
      const jobIds = applications.map((app) => app.jobId).filter(Boolean);

      const [candidates, jobs, organization] = await Promise.all([
        userStore.getSummaries(candidateIds),
        Promise.all(jobIds.map((id) => jobStore.getById(id))),
        organizationStore.getById(organizationId),
      ]);

      const jobMap = new Map(jobs.filter(Boolean).map((job) => [job.id, job]));

      const enriched = applications.map((app) =>
        sanitizeApplication(app, candidates.get(app.candidateId), jobMap.get(app.jobId), organization),
      );

      res.json({
        success: true,
        applications: enriched,
        total: enriched.length,
        pagination: page
          ? {
            limit: requestedLimit,
            nextCursor: page.nextCursor || null,
            hasMore: page.hasMore === true,
          }
          : null,
      });
    } catch (error) {
      logger.error('Get organization applications error:', error);
      next(error);
    }
  }

  /**
   * Bulk update application status (recruiter)
   */
  static async bulkUpdateApplicationStatuses(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const userId = req.user.id;
      const {
        applicationIds = [],
        status,
      } = req.body || {};

      const targetStatus = normalizeApplicationStatus(status);
      if (!targetStatus) {
        return res.status(400).json({
          error: 'Invalid status value',
          details: { allowedStatuses: APPLICATION_STATUSES },
        });
      }

      const dedupedIds = [...new Set(applicationIds.filter(Boolean).map((id) => String(id).trim()))];
      if (dedupedIds.length === 0) {
        return res.status(400).json({ error: 'At least one application ID is required' });
      }

      const fetchedApplications = await Promise.all(
        dedupedIds.map(async (applicationId) => {
          try {
            const application = await jobApplicationStore.getById(applicationId);
            return { applicationId, application, error: null };
          } catch (fetchError) {
            return { applicationId, application: null, error: fetchError };
          }
        }),
      );

      const results = [];
      const updatedApplications = [];
      const statusChangedAt = new Date().toISOString();

      for (const item of fetchedApplications) {
        const { applicationId, application, error } = item;
        if (error) {
          results.push({
            applicationId,
            updated: false,
            reason: 'FETCH_ERROR',
            message: 'Failed to load application.',
          });
          continue;
        }
        if (!application) {
          results.push({
            applicationId,
            updated: false,
            reason: 'NOT_FOUND',
            message: 'Application not found.',
          });
          continue;
        }
        if (application.organizationId !== organizationId) {
          results.push({
            applicationId,
            updated: false,
            reason: 'ACCESS_DENIED',
            message: 'Application does not belong to your organization.',
          });
          continue;
        }

        const previousStatus = normalizeApplicationStatus(application.status);
        if (!canTransitionApplicationStatus(previousStatus, targetStatus, { allowNoop: true })) {
          results.push({
            applicationId,
            updated: false,
            reason: 'INVALID_TRANSITION',
            message: `Cannot transition from ${previousStatus} to ${targetStatus}.`,
            allowedNextStatuses: getAllowedApplicationTransitions(previousStatus),
          });
          continue;
        }

        const disposition = normalizeDisposition(req.body, {
          status: targetStatus,
          withdrawnBy: null,
          jobDeletedAt: null,
        });
        const isFinalDecision = targetStatus === 'REJECTED' || targetStatus === 'HIRED';
        const statusHistoryEntry = buildStatusHistoryEntry({
          previousStatus,
          status: targetStatus,
          changedAt: statusChangedAt,
          changedBy: userId,
          source: 'RECRUITER_BULK',
          note: disposition.notes || disposition.reason || null,
          dispositionCode: disposition.code,
          dispositionCategory: disposition.category,
        });

        const updated = await jobApplicationStore.update(applicationId, {
          status: targetStatus,
          reviewedAt: statusChangedAt,
          reviewedBy: userId,
          statusSource: 'RECRUITER_BULK',
          statusChangedAt,
          ...(isFinalDecision
            ? {
              dispositionCode: disposition.code,
              dispositionCategory: disposition.category,
              dispositionReason: disposition.reason,
              dispositionNotes: disposition.notes,
              dispositionTags: disposition.tags,
              dispositionAt: statusChangedAt,
              dispositionBy: userId,
            }
            : {
              dispositionCode: null,
              dispositionCategory: null,
              dispositionReason: null,
              dispositionNotes: null,
              dispositionTags: [],
              dispositionAt: null,
              dispositionBy: null,
            }),
          statusHistory: appendStatusHistory(application.statusHistory, statusHistoryEntry),
        });

        updatedApplications.push(updated);
        results.push({
          applicationId,
          updated: true,
          status: updated.status,
        });

        await publishOrganizationRealtimeUpdate(organizationId, 'application-status-updated', {
          applicationId: updated.id,
          jobId: updated.jobId || null,
          candidateId: updated.candidateId || null,
          status: updated.status || targetStatus,
        });
        await publishCandidateRealtimeUpdate(updated.candidateId, 'application-status-updated', {
          applicationId: updated.id,
          jobId: updated.jobId || null,
          organizationId,
          status: updated.status || targetStatus,
        });
      }

      await activityLogStore.record({
        organizationId,
        actorId: userId,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'APPLICATION_STATUS_BULK_UPDATED',
        targetType: 'APPLICATION',
        targetId: null,
        metadata: {
          totalRequested: dedupedIds.length,
          updatedCount: updatedApplications.length,
          targetStatus,
        },
      });

      res.json({
        success: true,
        targetStatus,
        totalRequested: dedupedIds.length,
        updatedCount: updatedApplications.length,
        skippedCount: dedupedIds.length - updatedApplications.length,
        results,
      });
    } catch (error) {
      logger.error('Bulk update application statuses error:', error);
      next(error);
    }
  }
}

