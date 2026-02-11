import {
  teamInvitationStore,
  organizationStore,
  organizationMemberStore,
  publishOrganizationRealtimeUpdate,
  userStore,
} from '../services/firebaseData.service.js';
import { emailService } from '../services/email.service.js';
import logger from '../utils/logger.js';

export class TeamInvitationController {
  /**
   * Send team invitation
   * POST /api/organizations/me/team-invitations
   */
  static async sendInvitation(req, res, next) {
    try {
      const { email, role } = req.body;
      const userId = req.user.id;
      const organizationId = req.user.organizationContext?.organization?.id;
      const organizationName = req.user.organizationContext?.organization?.name;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization context required' });
      }

      // Check if user already exists in the organization
      const existingUser = await userStore.getByEmail(email);
      if (existingUser) {
        const existingMember = await organizationMemberStore.getMember(organizationId, existingUser.id);
        if (existingMember) {
          return res.status(409).json({ 
            error: 'User is already a member of this organization',
            member: existingMember 
          });
        }
      }

      // Check if there's already a pending invitation
      const existingInvitation = await teamInvitationStore.findPendingByEmail(organizationId, email);
      if (existingInvitation) {
        return res.status(409).json({ 
          error: 'Pending invitation already exists for this email',
          invitation: existingInvitation 
        });
      }

      // Create invitation
      const invitation = await teamInvitationStore.create({
        organizationId,
        email,
        role,
        invitedBy: userId,
      });

      // Send invitation email
      try {
        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:4028'}/accept-team-invite/${invitation.token}`;
        await emailService.sendTeamInvitation({
          to: email,
          organizationName,
          role,
          inviteLink,
          expiresInDays: 7,
        });
      } catch (emailError) {
        logger.error('Failed to send invitation email:', emailError);
        // Continue even if email fails - user can still be invited manually
      }

      await publishOrganizationRealtimeUpdate(organizationId, 'team-invitation-created', {
        invitationId: invitation.id,
        email: invitation.email || null,
        role: invitation.role || null,
        status: invitation.status || 'PENDING',
      });

      res.status(201).json({
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          invitedAt: invitation.invitedAt,
          expiresAt: invitation.expiresAt,
        },
      });
    } catch (error) {
      logger.error('Send team invitation error:', error);
      next(error);
    }
  }

  /**
   * List team invitations
   * GET /api/organizations/me/team-invitations
   */
  static async listInvitations(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const { status } = req.query;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization context required' });
      }

      const invitations = await teamInvitationStore.listByOrganization(organizationId, status);

      // Enrich with inviter info
      const enriched = await Promise.all(
        invitations.map(async (inv) => {
          const inviter = await userStore.getById(inv.invitedBy);
          return {
            ...inv,
            invitedByUser: inviter ? {
              fullName: inviter.fullName,
              email: inviter.email,
            } : null,
          };
        })
      );

      res.json({
        success: true,
        invitations: enriched,
      });
    } catch (error) {
      logger.error('List team invitations error:', error);
      next(error);
    }
  }

  /**
   * Get invitation by token (public endpoint for viewing invitation)
   * GET /api/public/team-invitations/:token
   */
  static async getInvitationByToken(req, res, next) {
    try {
      const { token } = req.params;

      const invitation = await teamInvitationStore.getByToken(token);

      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      // Check if valid
      if (!teamInvitationStore.isValid(invitation)) {
        return res.status(400).json({ 
          error: 'Invitation is expired or no longer valid',
          status: invitation.status,
        });
      }

      // Get organization info
      const organization = await organizationStore.getById(invitation.organizationId);

      res.json({
        success: true,
        invitation: {
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          organization: {
            name: organization?.name || organization?.displayName,
            logo: organization?.logo,
          },
        },
      });
    } catch (error) {
      logger.error('Get invitation by token error:', error);
      next(error);
    }
  }

  /**
   * Accept team invitation and create account
   * POST /api/team-invitations/accept
   */
  static async acceptInvitation(req, res, next) {
    try {
      const { token, fullName, password } = req.body;

      // Get invitation
      const invitation = await teamInvitationStore.getByToken(token);

      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      // Validate invitation
      if (!teamInvitationStore.isValid(invitation)) {
        return res.status(400).json({ 
          error: 'Invitation is expired or no longer valid',
          status: invitation.status,
        });
      }

      // Check if user already exists
      const existingUser = await userStore.getByEmail(invitation.email);
      if (existingUser) {
        return res.status(409).json({ 
          error: 'An account with this email already exists. Please login instead.',
        });
      }

      // Note: The actual user creation and Firebase auth setup should happen in the auth controller
      // This endpoint just validates the invitation and returns the details needed for registration
      res.json({
        success: true,
        invitation: {
          email: invitation.email,
          role: invitation.role,
          organizationId: invitation.organizationId,
          token,
        },
        message: 'Invitation is valid. Proceed with registration.',
      });
    } catch (error) {
      logger.error('Accept team invitation error:', error);
      next(error);
    }
  }

  /**
   * Revoke team invitation
   * DELETE /api/organizations/me/team-invitations/:id
   */
  static async revokeInvitation(req, res, next) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organizationContext?.organization?.id;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization context required' });
      }

      // Get invitation to verify it belongs to this organization
      const invitation = await teamInvitationStore.getById(id);

      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      if (invitation.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await teamInvitationStore.revoke(id);

      await publishOrganizationRealtimeUpdate(organizationId, 'team-invitation-revoked', {
        invitationId: id,
      });

      res.json({
        success: true,
        message: 'Invitation revoked successfully',
      });
    } catch (error) {
      logger.error('Revoke team invitation error:', error);
      next(error);
    }
  }

  /**
   * Resend team invitation email
   * POST /api/organizations/me/team-invitations/:id/resend
   */
  static async resendInvitation(req, res, next) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organizationContext?.organization?.id;
      const organizationName = req.user.organizationContext?.organization?.name;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization context required' });
      }

      // Get invitation
      const invitation = await teamInvitationStore.getById(id);

      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      if (invitation.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!teamInvitationStore.isValid(invitation)) {
        return res.status(400).json({ error: 'Invitation is no longer valid' });
      }

      // Resend email
      const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:4028'}/accept-team-invite/${invitation.token}`;
      await emailService.sendTeamInvitation({
        to: invitation.email,
        organizationName,
        role: invitation.role,
        inviteLink,
        expiresInDays: 7,
      });

      await publishOrganizationRealtimeUpdate(organizationId, 'team-invitation-resent', {
        invitationId: invitation.id,
        email: invitation.email || null,
      });

      res.json({
        success: true,
        message: 'Invitation email resent successfully',
      });
    } catch (error) {
      logger.error('Resend team invitation error:', error);
      next(error);
    }
  }
}

