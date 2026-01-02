import { activityLogStore, invitationStore, jobStore, interviewStore, userStore, organizationStore } from '../services/firebaseData.service.js';
import { emailNotifications } from '../services/email.service.js';
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
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
    metadata: invitation.metadata || {},
  };
};

export class InvitationController {
  static async createInvitation(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const { jobId } = req.body;

      const job = await jobStore.getById(jobId);
      if (!job || job.organizationId !== organizationId) {
        return res.status(404).json({ error: 'Job not found for organization' });
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

      // Send invitation email
      try {
        const organization = await organizationStore.getById(organizationId);
        if (organization) {
          await emailNotifications.sendInvitationReceived(invitation, job, organization);
          logger.info(`Invitation email sent to ${invitation.email}`);
        }
      } catch (emailError) {
        logger.error('Failed to send invitation email:', emailError);
        // Don't fail the request if email fails
      }

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

      const job = await jobStore.getById(invitation.jobId);
      if (!job || job.status !== 'PUBLISHED') {
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

  static async acceptInvitation(req, res, next) {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: 'Invitation token is required' });
      }

      const invitation = await invitationStore.getByToken(token);
      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      if (invitation.status !== 'PENDING') {
        // Check if interview already exists for this invitation
        const existingInterview = await interviewStore.getByInvitationId(invitation.id);
        if (existingInterview) {
          return res.json({
            success: true,
            invitation: sanitizeInvitation(invitation),
            interview: { id: existingInterview.id },
            message: 'Invitation already accepted',
          });
        }
        return res.status(400).json({ error: 'Invitation is no longer available' });
      }

      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        return res.status(400).json({ error: 'Invitation has expired' });
      }

      // Mark invitation as accepted
      const accepted = await invitationStore.markAccepted(token, req.user.id);

      // Get job details for interview creation
      const job = await jobStore.getById(invitation.jobId);
      if (!job) {
        return res.status(404).json({ error: 'Associated job not found' });
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

      logger.info(`Interview ${interview.id} created for accepted invitation ${invitation.id}`);

      res.json({
        success: true,
        invitation: sanitizeInvitation(accepted),
        interview: { id: interview.id },
        message: 'Invitation accepted and interview created',
      });
    } catch (error) {
      logger.error('Accept invitation error:', error);
      next(error);
    }
  }
}

