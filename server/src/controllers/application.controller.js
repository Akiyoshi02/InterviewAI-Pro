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
import logger from '../utils/logger.js';

const sanitizeApplication = (application, candidate = null, job = null, organization = null) => {
  if (!application) return null;
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
    interviewId: application.interviewId,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    candidate,
    job: job ? {
      id: job.id,
      title: job.title,
      department: job.department,
      location: job.location,
      employmentType: job.employmentType,
      skills: job.skills || [],
    } : null,
    organization: organization ? {
      id: organization.id,
      name: organization.name || organization.displayName,
      logo: organization.logo,
      website: organization.website,
    } : null,
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
      const application = await jobApplicationStore.create({
        jobId,
        candidateId,
        organizationId: job.organizationId,
        status: 'SUBMITTED',
        resumeUrl: resumeUrl || req.user.profile?.resumeUrl,
        coverLetter: coverLetter || null,
        answers: answers || [],
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

      // Send confirmation email to candidate
      let organization = null;
      try {
        organization = await organizationStore.getById(job.organizationId);
        if (organization) {
          await emailNotifications.sendApplicationReceived(application, req.user, job, organization);
          logger.info(`Application confirmation email sent to ${req.user.email}`);
        }
      } catch (emailError) {
        logger.error('Failed to send application confirmation email:', emailError);
        // Don't fail the request if email fails
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
      const applications = await jobApplicationStore.listByCandidate(candidateId);

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

      // Verify job belongs to organization
      const job = await jobStore.getById(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const applications = await jobApplicationStore.listByJob(jobId);

      // Enrich with candidate details
      const candidateIds = applications.map((app) => app.candidateId).filter(Boolean);
      const candidates = await userStore.getSummaries(candidateIds);

      const enriched = applications.map((app) =>
        sanitizeApplication(app, candidates.get(app.candidateId), null, null),
      );

      res.json({
        success: true,
        applications: enriched,
        job: {
          id: job.id,
          title: job.title,
          department: job.department,
        },
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

      const updated = await jobApplicationStore.update(id, {
        status,
        reviewedAt: new Date().toISOString(),
        reviewedBy: userId,
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
          status,
          jobId: application.jobId,
        },
      });

      logger.info(`Application ${id} status updated to ${status} by ${userId}`);

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

      // Send status update email to candidate
      try {
        const [candidate, job, organization] = await Promise.all([
          userStore.getSummary(application.candidateId),
          jobStore.getById(application.jobId),
          organizationStore.getById(organizationId),
        ]);
        
        if (candidate && job && organization) {
          await emailNotifications.sendApplicationStatusUpdated(updated, candidate, job, organization);
          logger.info(`Status update email sent to ${candidate.email}`);
        }
      } catch (emailError) {
        logger.error('Failed to send status update email:', emailError);
        // Don't fail the request if email fails
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

      const updated = await jobApplicationStore.update(id, {
        status: 'REJECTED',
        withdrawnBy: candidateId, // Track that this was withdrawn by the candidate
        updatedAt: new Date().toISOString(),
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
      const { status, limit = 50 } = req.query;

      let applications = await jobApplicationStore.listByOrganization(organizationId, parseInt(limit));

      // Filter by status if provided
      if (status) {
        applications = applications.filter((app) => app.status === status.toUpperCase());
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
      });
    } catch (error) {
      logger.error('Get organization applications error:', error);
      next(error);
    }
  }
}

