import {
  activityLogStore,
  invitationStore,
  jobStore,
  jobApplicationStore,
  isJobCurrentlyPublic,
  interviewStore,
  organizationStore,
  recordRealtimeEvent,
  publishOrganizationRealtimeUpdate,
  publishCandidateRealtimeUpdate,
  userStore,
} from '../services/firebaseData.service.js';
import { emailNotifications } from '../services/email.service.js';
import { queueEmailJob } from '../services/backgroundJobQueue.service.js';
import { buildJobSnapshot, buildOrganizationSnapshot } from '../utils/applicationSnapshot.util.js';
import {
  appendStatusHistory,
  buildStatusHistoryEntry,
  normalizeApplicationStatus,
} from '../utils/applicationLifecycle.util.js';
import logger from '../utils/logger.js';

const sanitizeInvitation = (invitation) => {
  if (!invitation) return null;
  return {
    id: invitation.id,
    email: invitation.email,
    jobId: invitation.jobId,
    organizationId: invitation.organizationId,
    stage: invitation.stage,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    candidateUserId: invitation.candidateUserId,
    invitedBy: invitation.invitedBy,
    acceptedAt: invitation.acceptedAt,
    acceptedInterviewId: invitation.acceptedInterviewId || null,
    acceptedApplicationId: invitation.acceptedApplicationId || null,
    acceptanceInProgress: Boolean(invitation.acceptanceInProgress),
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
    metadata: invitation.metadata || {},
  };
};

export class InvitationController {
  static async createInvitation(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const { jobId, email } = req.body;

      const job = await jobStore.getById(jobId);
      if (!job || job.organizationId !== organizationId) {
        return res.status(404).json({ error: 'Job not found for organization' });
      }

      const normalizedEmail = String(email || '').trim().toLowerCase();
      const pendingInvitation = await invitationStore.findActiveByJobAndEmail(
        organizationId,
        jobId,
        normalizedEmail,
      );
      if (pendingInvitation) {
        return res.status(409).json({
          error: 'An active invitation already exists for this candidate and job.',
          code: 'DUPLICATE_ACTIVE_INVITATION',
          invitation: sanitizeInvitation(pendingInvitation),
        });
      }

      const invitation = await invitationStore.create({
        organizationId,
        invitedBy: req.user.id,
        ...req.body,
      });

      await activityLogStore.record({
        organizationId,
        actorId: req.user.id,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'INVITATION_SENT',
        targetType: 'INVITATION',
        targetId: invitation.id,
        metadata: {
          jobId,
          email: invitation.email,
        },
      });

      // Send invitation email in background.
      const organization = await organizationStore.getById(organizationId).catch(() => null);
      if (organization) {
        queueEmailJob({
          type: 'INVITATION_RECEIVED',
          payload: {
            invitationId: invitation.id,
            recipient: invitation.email,
          },
          handler: async () => {
            await emailNotifications.sendInvitationReceived(invitation, job, organization);
            logger.info(`Invitation email sent to ${invitation.email}`);
          },
        });
      }

      await publishOrganizationRealtimeUpdate(organizationId, 'invitation-created', {
        invitationId: invitation.id,
        jobId: invitation.jobId || null,
        email: invitation.email || null,
        status: invitation.status || 'PENDING',
      });

      res.status(201).json({ success: true, invitation: sanitizeInvitation(invitation) });
    } catch (error) {
      logger.error('Create invitation error:', error);
      next(error);
    }
  }

  static async listInvitations(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const invitations = await invitationStore.listByOrganization(organizationId);
      res.json({
        success: true,
        invitations: invitations.map(sanitizeInvitation),
      });
    } catch (error) {
      logger.error('List invitations error:', error);
      next(error);
    }
  }

  static async previewInvitation(req, res, next) {
    try {
      const { token } = req.params;
      const invitation = await invitationStore.getByToken(token);
      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      let job = await jobStore.getById(invitation.jobId);
      if (job?.status === 'PUBLISHED' && job.scheduledPublishAt && !job.publishedAt) {
        await jobStore.autoPublishScheduledJobs();
        job = await jobStore.getById(invitation.jobId);
      }
      if (!isJobCurrentlyPublic(job)) {
        return res.status(404).json({ error: 'Associated job not available' });
      }

      res.json({
        success: true,
        invitation: {
          email: invitation.email,
          jobId: invitation.jobId,
          organizationId: invitation.organizationId,
          stage: invitation.stage,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
        job: {
          id: job.id,
          title: job.title,
          department: job.department,
          description: job.description,
          interviewTypes: job.templateConfig?.interviewTypes || [],
          duration: job.templateConfig?.duration || 30,
        },
      });
    } catch (error) {
      logger.error('Preview invitation error:', error);
      next(error);
    }
  }

  static async revokeInvitation(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const { id } = req.params;

      const invitation = await invitationStore.getById(id);
      if (!invitation || invitation.organizationId !== organizationId) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      if (invitation.status === 'REVOKED') {
        return res.status(409).json({ error: 'Invitation is already revoked' });
      }
      if (invitation.status === 'ACCEPTED') {
        return res.status(409).json({ error: 'Cannot revoke an accepted invitation' });
      }

      const updated = await invitationStore.update(id, {
        status: 'REVOKED',
        revokedAt: new Date().toISOString(),
        revokedBy: req.user.id,
      });

      await activityLogStore.record({
        organizationId,
        actorId: req.user.id,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'INVITATION_REVOKED',
        targetType: 'INVITATION',
        targetId: id,
        metadata: { email: invitation.email, jobId: invitation.jobId },
      });

      await publishOrganizationRealtimeUpdate(organizationId, 'invitation-revoked', {
        invitationId: id,
        email: invitation.email || null,
        status: 'REVOKED',
      });

      res.json({ success: true, invitation: sanitizeInvitation(updated || invitation) });
    } catch (error) {
      logger.error('Revoke invitation error:', error);
      next(error);
    }
  }

  static async acceptInvitation(req, res, next) {
    let claimedInvitationId = null;
    let acceptanceFinalized = false;

    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: 'Invitation token is required' });
      }

      const claim = await invitationStore.claimForAcceptance(token, req.user.id);
      if (claim.status === 'NOT_FOUND' || !claim.invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      const invitation = claim.invitation;
      if (claim.status === 'EXPIRED') {
        return res.status(400).json({ error: 'Invitation has expired' });
      }
      if (claim.status === 'IN_PROGRESS') {
        const existingInterview = await interviewStore.getByInvitationId(invitation.id);
        if (existingInterview) {
          return res.json({
            success: true,
            invitation: sanitizeInvitation(invitation),
            interview: { id: existingInterview.id },
            message: 'Invitation already accepted',
          });
        }
        return res.status(202).json({
          success: false,
          code: 'INVITATION_ACCEPTANCE_IN_PROGRESS',
          message: 'Invitation acceptance is already being processed. Please retry shortly.',
          invitation: sanitizeInvitation(invitation),
        });
      }
      if (claim.status === 'ALREADY_COMPLETED') {
        const existingInterview = invitation.acceptedInterviewId
          ? await interviewStore.getById(invitation.acceptedInterviewId)
          : await interviewStore.getByInvitationId(invitation.id);
        if (existingInterview) {
          return res.json({
            success: true,
            invitation: sanitizeInvitation(invitation),
            interview: { id: existingInterview.id },
            message: 'Invitation already accepted',
          });
        }
      }
      if (claim.status !== 'CLAIMED' && claim.status !== 'ALREADY_COMPLETED') {
        return res.status(400).json({ error: 'Invitation is no longer available' });
      }
      if (claim.status === 'CLAIMED') {
        claimedInvitationId = invitation.id;
      }
      const releaseClaimLock = async (revertToPending = false) => {
        if (!claimedInvitationId || acceptanceFinalized) return;
        await invitationStore.releaseAcceptanceLock(claimedInvitationId, { revertToPending });
        claimedInvitationId = null;
      };

      // Get job details for interview creation
      const [job, organization, candidateProfile] = await Promise.all([
        jobStore.getById(invitation.jobId),
        organizationStore.getById(invitation.organizationId).catch(() => null),
        userStore.getById(req.user.id).catch(() => null),
      ]);
      if (!job) {
        await releaseClaimLock(true);
        return res.status(404).json({ error: 'Associated job not found' });
      }
      if (!isJobCurrentlyPublic(job) || job.acceptingApplications === false) {
        await releaseClaimLock(true);
        return res.status(409).json({
          error: 'Associated job is no longer accepting invitations or applications.',
          code: 'JOB_NOT_ACCEPTING_INVITATIONS',
        });
      }

      const statusChangedAt = new Date().toISOString();
      let application = await jobApplicationStore.checkDuplicate(invitation.jobId, req.user.id);
      const existingStatus = normalizeApplicationStatus(application?.status);
      if (existingStatus === 'HIRED') {
        await releaseClaimLock(true);
        return res.status(409).json({
          error: 'Candidate is already marked as hired for this job.',
          code: 'APPLICATION_ALREADY_HIRED',
          application: { id: application.id, status: application.status },
        });
      }
      const shouldCreateFreshApplication = !application || existingStatus === 'REJECTED';

      if (shouldCreateFreshApplication) {
        application = await jobApplicationStore.create({
          jobId: invitation.jobId,
          candidateId: req.user.id,
          organizationId: invitation.organizationId,
          status: 'INTERVIEWING',
          resumeUrl: candidateProfile?.resumeUrl || req.user.profile?.resumeUrl || null,
          coverLetter: null,
          answers: [],
          jobSnapshot: buildJobSnapshot(job),
          organizationSnapshot: buildOrganizationSnapshot(organization, invitation.organizationId),
          statusSource: 'INVITATION_ACCEPTANCE',
          statusChangedAt,
          statusHistory: [
            buildStatusHistoryEntry({
              previousStatus: null,
              status: 'INTERVIEWING',
              changedAt: statusChangedAt,
              changedBy: req.user.id,
              source: 'INVITATION_ACCEPTANCE',
              note: 'Application created from accepted invitation.',
            }),
          ],
          submittedAt: statusChangedAt,
        });
      } else if (existingStatus !== 'INTERVIEWING' && existingStatus !== 'HIRED') {
        application = await jobApplicationStore.update(application.id, {
          status: 'INTERVIEWING',
          reviewedAt: statusChangedAt,
          reviewedBy: invitation.invitedBy || null,
          statusSource: 'INVITATION_ACCEPTANCE',
          statusChangedAt,
          dispositionCode: null,
          dispositionCategory: null,
          dispositionReason: null,
          dispositionNotes: null,
          dispositionTags: [],
          dispositionAt: null,
          dispositionBy: null,
          statusHistory: appendStatusHistory(
            application.statusHistory,
            buildStatusHistoryEntry({
              previousStatus: application.status,
              status: 'INTERVIEWING',
              changedAt: statusChangedAt,
              changedBy: req.user.id,
              source: 'INVITATION_ACCEPTANCE',
              note: 'Application moved to interviewing after invitation acceptance.',
            }),
          ),
        });
      }

      const existingInterview = invitation.acceptedInterviewId
        ? await interviewStore.getById(invitation.acceptedInterviewId)
        : await interviewStore.getByInvitationId(invitation.id);
      if (existingInterview) {
        const finalizedInvitation = await invitationStore.finalizeAcceptance(invitation.id, {
          interviewId: existingInterview.id,
          applicationId: application?.id || invitation.acceptedApplicationId || null,
        });
        acceptanceFinalized = true;
        return res.json({
          success: true,
          invitation: sanitizeInvitation(finalizedInvitation || invitation),
          interview: { id: existingInterview.id },
          application: application ? { id: application.id, status: application.status } : null,
          message: 'Invitation already accepted',
        });
      }

      // Create an interview linked to this invitation
      const interview = await interviewStore.create({
        mode: 'HIRING',
        candidateId: req.user.id,
        companyId: invitation.invitedBy,
        organizationId: invitation.organizationId,
        jobId: invitation.jobId,
        jobStage: invitation.stage || 'INITIAL_SCREENING',
        invitationId: invitation.id,
        jobRole: job.title,
        experienceLevel: job.experienceLevel || 'MID',
        industry: job.department || 'Technology',
        interviewTypes: job.templateConfig?.interviewTypes || ['BEHAVIORAL', 'TECHNICAL'],
        skillFocus: job.requiredSkills || [],
        duration: job.templateConfig?.duration || 30,
        config: job.templateConfig || null,
      });

      const accepted = await invitationStore.finalizeAcceptance(invitation.id, {
        interviewId: interview.id,
        applicationId: application?.id || null,
      });
      acceptanceFinalized = true;

      try {
        await recordRealtimeEvent(interview.id, 'interview-created', {
          actor: req.user.id,
          status: interview.status || 'SCHEDULED',
          mode: interview.mode || 'HIRING',
        });
      } catch (eventError) {
        logger.warn(`Failed to publish interview-created event for invitation ${invitation.id}:`, eventError);
      }

      await publishOrganizationRealtimeUpdate(invitation.organizationId, 'invitation-accepted', {
        invitationId: invitation.id,
        interviewId: interview.id,
        applicationId: application?.id || null,
        candidateId: req.user.id,
        status: accepted?.status || 'ACCEPTED',
      });
      await publishCandidateRealtimeUpdate(req.user.id, 'invitation-accepted', {
        invitationId: invitation.id,
        interviewId: interview.id,
        applicationId: application?.id || null,
        organizationId: invitation.organizationId,
        status: accepted?.status || 'ACCEPTED',
      });

      if (application?.id) {
        await publishOrganizationRealtimeUpdate(invitation.organizationId, 'application-status-updated', {
          applicationId: application.id,
          jobId: application.jobId || invitation.jobId,
          candidateId: application.candidateId || req.user.id,
          status: application.status || 'INTERVIEWING',
        });
        await publishCandidateRealtimeUpdate(req.user.id, 'application-status-updated', {
          applicationId: application.id,
          jobId: application.jobId || invitation.jobId,
          organizationId: invitation.organizationId,
          status: application.status || 'INTERVIEWING',
        });
      }

      logger.info(`Interview ${interview.id} created for accepted invitation ${invitation.id}`);

      res.json({
        success: true,
        invitation: sanitizeInvitation(accepted),
        interview: { id: interview.id },
        application: application ? { id: application.id, status: application.status } : null,
        message: 'Invitation accepted and interview created',
      });
    } catch (error) {
      if (claimedInvitationId && !acceptanceFinalized) {
        try {
          await invitationStore.releaseAcceptanceLock(claimedInvitationId);
        } catch (releaseError) {
          logger.warn(`Failed to release invitation acceptance lock for ${claimedInvitationId}:`, releaseError);
        }
      }
      logger.error('Accept invitation error:', error);
      next(error);
    }
  }
}

