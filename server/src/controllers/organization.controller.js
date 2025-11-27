import { activityLogStore, organizationMemberStore, organizationStore, userStore } from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';

const sanitizeOrganization = (organization) => {
  if (!organization) return null;
  return {
    id: organization.id,
    name: organization.name,
    displayName: organization.displayName,
    industry: organization.industry,
    companySize: organization.companySize,
    branding: organization.branding || { theme: 'default' },
    settings: organization.settings || {},
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  };
};

const sanitizeMembership = (membership) => {
  if (!membership) return null;
  return {
    id: membership.id,
    userId: membership.userId,
    organizationId: membership.organizationId,
    role: membership.role,
    status: membership.status,
    permissions: membership.permissions || [],
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
  };
};

const sanitizeUserSummary = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || null,
    fullName: user.fullName || null,
  };
};

export class OrganizationController {
  static async getMyOrganization(req, res, next) {
    try {
      const context = req.user.organizationContext;
      if (!context?.organization || !context?.membership) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      res.json({
        success: true,
        organization: sanitizeOrganization(context.organization),
        membership: sanitizeMembership(context.membership),
      });
    } catch (error) {
      logger.error('Get organization error:', error);
      next(error);
    }
  }

  static async updateMyOrganization(req, res, next) {
    try {
      const context = req.user.organizationContext;
      if (!context?.organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const allowedFields = ['name', 'displayName', 'industry', 'companySize', 'branding', 'settings'];
      const payload = {};

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          payload[field] = req.body[field];
        }
      });

      if (Object.keys(payload).length === 0) {
        return res.json({
          success: true,
          organization: sanitizeOrganization(context.organization),
        });
      }

      const updated = await organizationStore.update(context.organization.id, payload);

      res.json({
        success: true,
        organization: sanitizeOrganization(updated),
      });
    } catch (error) {
      logger.error('Update organization error:', error);
      next(error);
    }
  }

  static async listMembers(req, res, next) {
    try {
      const organization = req.user.organizationContext?.organization;
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const members = await organizationMemberStore.listByOrganization(organization.id);
      const summaries = await userStore.getSummaries(members.map((member) => member.userId));

      const enrichedMembers = members.map((member) => ({
        ...sanitizeMembership(member),
        user: summaries.get(member.userId) || null,
      }));

      res.json({
        success: true,
        members: enrichedMembers,
      });
    } catch (error) {
      logger.error('List organization members error:', error);
      next(error);
    }
  }

  static async upsertMember(req, res, next) {
    try {
      const organization = req.user.organizationContext?.organization;
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const { userId, role, status, permissions } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const membership = await organizationMemberStore.addMember({
        organizationId: organization.id,
        userId,
        role,
        status: status || 'ACTIVE',
        permissions,
      });

      const userSummary = await userStore.getByUid(userId);

      await activityLogStore.record({
        organizationId: organization.id,
        actorId: req.user.id,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'MEMBER_UPDATED',
        targetType: 'MEMBER',
        targetId: userId,
        metadata: { role, status: status || 'ACTIVE' },
      });

      res.status(201).json({
        success: true,
        member: {
          ...sanitizeMembership(membership),
          user: sanitizeUserSummary(userSummary),
        },
      });
    } catch (error) {
      logger.error('Upsert organization member error:', error);
      next(error);
    }
  }
}

