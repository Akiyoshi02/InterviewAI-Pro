import {
  organizationStore,
  organizationMemberStore,
  userStore,
  systemSettingsStore,
  platformAuditLogStore,
  interviewStore,
  jobStore,
} from '../services/firebaseData.service.js';
import { emailNotifications } from '../services/email.service.js';
import logger from '../utils/logger.js';
import admin, { realtimeDb } from '../config/firebase.js';

const ensureRealtimeAdmin = async ({ uid, email, fullName }) => {
  if (!realtimeDb || !uid) return;
  try {
    await realtimeDb.ref(`admins/${uid}`).set({
      uid,
      email: email || null,
      fullName: fullName || null,
      updatedAt: admin.database.ServerValue.TIMESTAMP,
    });
  } catch (error) {
    logger.error('Failed to register system admin in realtime database:', error);
  }
};

const sanitizeOrganization = (org) => {
  if (!org) return null;
  return {
    id: org.id,
    name: org.name,
    displayName: org.displayName,
    ownerId: org.ownerId,
    industry: org.industry,
    companySize: org.companySize,
    status: org.status,
    approvedBy: org.approvedBy,
    approvedAt: org.approvedAt,
    rejectedReason: org.rejectedReason,
    suspensionReason: org.suspensionReason,
    branding: org.branding,
    settings: org.settings,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
};

const sanitizeUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    accountType: user.accountType,
    fullName: user.fullName,
    companyName: user.companyName,
    primaryOrganizationId: user.primaryOrganizationId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export class AdminController {
  /**
   * Bootstrap initial system admin account (creates Firebase user + Firestore profile)
   * This should be called manually or via a secure admin script
   * Only use this for the first admin setup
   */
  static async bootstrapAdmin(req, res, next) {
    try {
      const { email, password, fullName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Note: We allow creating multiple system admins for flexibility
      // The first admin can promote others later

      // Create Firebase Auth user
      let firebaseUser;
      try {
        firebaseUser = await admin.auth().createUser({
          email,
          password,
          displayName: fullName || 'System Administrator',
          emailVerified: true, // Auto-verify admin email
        });
      } catch (error) {
        if (error.code === 'auth/email-already-exists') {
          // User exists in Firebase, try to get their UID
          const existingUser = await admin.auth().getUserByEmail(email);
          firebaseUser = existingUser;
          logger.info(`Firebase user already exists for ${email}, using existing UID`);
        } else {
          throw error;
        }
      }

      const uid = firebaseUser.uid;

      // Check if user already exists in Firestore
      let user = await userStore.getByUid(uid);

      if (user) {
        if (user.accountType === 'SYSTEM_ADMIN') {
          await ensureRealtimeAdmin({
            uid,
            email: user.email || email,
            fullName: user.fullName || fullName,
          });
          return res.json({
            success: true,
            message: 'System admin already exists',
            user: sanitizeUser(user),
          });
        }

        // Update existing user to system admin
        user = await userStore.update(uid, {
          accountType: 'SYSTEM_ADMIN',
        });
      } else {
        // Create new system admin user in Firestore
        user = await userStore.create(uid, {
          email,
          accountType: 'SYSTEM_ADMIN',
          fullName: fullName || 'System Administrator',
        });
      }

      await ensureRealtimeAdmin({
        uid,
        email,
        fullName: user?.fullName || fullName,
      });

      // Initialize system settings if not exist
      await systemSettingsStore.initialize(uid);

      // Log the action
      await platformAuditLogStore.record({
        actorId: uid,
        actorType: 'SYSTEM_ADMIN',
        action: 'ADMIN_BOOTSTRAPPED',
        targetType: 'USER',
        targetId: uid,
        metadata: { email },
      });

      logger.info(`System admin bootstrapped: ${email} (${uid})`);

      res.status(201).json({
        success: true,
        message: 'System admin created successfully',
        user: sanitizeUser(user),
        credentials: {
          email,
          uid,
          note: 'You can now log in with this email and password',
        },
      });
    } catch (error) {
      logger.error('Bootstrap admin error:', error);
      next(error);
    }
  }

  /**
   * Seed initial system admin account (one-time operation)
   * This should be called manually or via a secure admin script
   * Requires user to already exist in Firebase Auth
   */
  static async seedAdmin(req, res, next) {
    try {
      const { email, uid } = req.body;

      if (!email || !uid) {
        return res.status(400).json({ error: 'Email and UID are required' });
      }

      // Check if user already exists
      let user = await userStore.getByUid(uid);

      if (user) {
        if (user.accountType === 'SYSTEM_ADMIN') {
          await ensureRealtimeAdmin({
            uid,
            email: user.email || email,
            fullName: user.fullName || req.body.fullName,
          });
          return res.json({
            success: true,
            message: 'System admin already exists',
            user: sanitizeUser(user),
          });
        }

        // Update existing user to system admin
        user = await userStore.update(uid, {
          accountType: 'SYSTEM_ADMIN',
        });
      } else {
        // Create new system admin user
        user = await userStore.create(uid, {
          email,
          accountType: 'SYSTEM_ADMIN',
          fullName: req.body.fullName || 'System Administrator',
        });
      }

      await ensureRealtimeAdmin({
        uid,
        email,
        fullName: user?.fullName || req.body.fullName,
      });

      // Initialize system settings if not exist
      await systemSettingsStore.initialize(uid);

      // Log the action
      await platformAuditLogStore.record({
        actorId: uid,
        actorType: 'SYSTEM_ADMIN',
        action: 'ADMIN_SEEDED',
        targetType: 'USER',
        targetId: uid,
        metadata: { email },
      });

      logger.info(`System admin seeded: ${email}`);

      res.status(201).json({
        success: true,
        message: 'System admin created successfully',
        user: sanitizeUser(user),
      });
    } catch (error) {
      logger.error('Seed admin error:', error);
      next(error);
    }
  }

  /**
   * List all organizations with optional status filter
   */
  static async listOrganizations(req, res, next) {
    try {
      const { status, limit = 100, offset = 0 } = req.query;

      let organizations;
      if (status) {
        organizations = await organizationStore.listByStatus(status, parseInt(limit));
      } else {
        organizations = await organizationStore.listAll(parseInt(limit), parseInt(offset));
      }

      // Enrich with owner information
      const ownerIds = organizations.map((org) => org.ownerId).filter(Boolean);
      const owners = await userStore.getSummaries(ownerIds);

      const enriched = organizations.map((org) => ({
        ...sanitizeOrganization(org),
        owner: owners.get(org.ownerId) || null,
      }));

      res.json({
        success: true,
        organizations: enriched,
        total: enriched.length,
      });
    } catch (error) {
      logger.error('List organizations error:', error);
      next(error);
    }
  }

  /**
   * Get pending organizations (awaiting approval)
   */
  static async listPendingOrganizations(req, res, next) {
    try {
      const { limit = 50 } = req.query;

      const organizations = await organizationStore.listByStatus('PENDING', parseInt(limit));

      // Enrich with owner information
      const ownerIds = organizations.map((org) => org.ownerId).filter(Boolean);
      const owners = await userStore.getSummaries(ownerIds);

      // Get member counts
      const enriched = await Promise.all(
        organizations.map(async (org) => {
          const members = await organizationMemberStore.listByOrganization(org.id);
          return {
            ...sanitizeOrganization(org),
            owner: owners.get(org.ownerId) || null,
            memberCount: members.length,
          };
        }),
      );

      res.json({
        success: true,
        organizations: enriched,
        total: enriched.length,
      });
    } catch (error) {
      logger.error('List pending organizations error:', error);
      next(error);
    }
  }

  /**
   * Get organization details
   */
  static async getOrganization(req, res, next) {
    try {
      const { id } = req.params;

      const organization = await organizationStore.getById(id);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      // Get members
      const members = await organizationMemberStore.listByOrganization(id);
      const userIds = members.map((m) => m.userId);
      const users = await userStore.getSummaries(userIds);

      // Get stats
      const jobs = await jobStore.listByOrganization(id);
      const interviews = await interviewStore.listByOrganization(id);

      res.json({
        success: true,
        organization: sanitizeOrganization(organization),
        members: members.map((m) => ({
          ...m,
          user: users.get(m.userId) || null,
        })),
        stats: {
          memberCount: members.length,
          jobCount: jobs.length,
          interviewCount: interviews.length,
        },
      });
    } catch (error) {
      logger.error('Get organization error:', error);
      next(error);
    }
  }

  /**
   * Approve organization
   */
  static async approveOrganization(req, res, next) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      const organization = await organizationStore.getById(id);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      if (organization.status === 'APPROVED') {
        return res.json({
          success: true,
          message: 'Organization is already approved',
          organization: sanitizeOrganization(organization),
        });
      }

      const approved = await organizationStore.approve(id, adminId);

      // Log the action
      await platformAuditLogStore.record({
        actorId: adminId,
        actorType: 'SYSTEM_ADMIN',
        action: 'ORG_APPROVED',
        targetType: 'ORGANIZATION',
        targetId: id,
        metadata: {
          organizationName: organization.name,
          ownerId: organization.ownerId,
        },
      });

      // Send approval email to organization owner
      try {
        const owner = await userStore.getByUid(organization.ownerId);
        if (owner) {
          await emailNotifications.sendOrganizationApproved(approved, owner);
          logger.info(`Approval email sent to ${owner.email}`);
        }
      } catch (emailError) {
        logger.error('Failed to send approval email:', emailError);
        // Don't fail the request if email fails
      }

      logger.info(`Organization approved: ${id} by admin ${adminId}`);

      res.json({
        success: true,
        message: 'Organization approved successfully',
        organization: sanitizeOrganization(approved),
      });
    } catch (error) {
      logger.error('Approve organization error:', error);
      next(error);
    }
  }

  /**
   * Reject organization
   */
  static async rejectOrganization(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user.id;

      const organization = await organizationStore.getById(id);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const rejected = await organizationStore.reject(id, reason, adminId);

      // Log the action
      await platformAuditLogStore.record({
        actorId: adminId,
        actorType: 'SYSTEM_ADMIN',
        action: 'ORG_REJECTED',
        targetType: 'ORGANIZATION',
        targetId: id,
        metadata: {
          organizationName: organization.name,
          ownerId: organization.ownerId,
          reason,
        },
      });

      // Send rejection email to organization owner
      try {
        const owner = await userStore.getByUid(organization.ownerId);
        if (!owner) {
          logger.warn(`Owner not found for organization ${id}, ownerId: ${organization.ownerId}`);
        } else if (!owner.email) {
          logger.warn(`Owner ${organization.ownerId} does not have an email address`);
        } else {
          logger.info(`Attempting to send rejection email to ${owner.email} for organization ${organization.name}`);
          await emailNotifications.sendOrganizationRejected(rejected, owner, reason);
          logger.info(`✅ Rejection email sent successfully to ${owner.email}`);
        }
      } catch (emailError) {
        logger.error('❌ Failed to send rejection email:', {
          error: emailError.message,
          stack: emailError.stack,
          organizationId: id,
          ownerId: organization.ownerId,
        });
        // Don't fail the request if email fails
      }

      logger.info(`Organization rejected: ${id} by admin ${adminId}, reason: ${reason}`);

      res.json({
        success: true,
        message: 'Organization rejected',
        organization: sanitizeOrganization(rejected),
      });
    } catch (error) {
      logger.error('Reject organization error:', error);
      next(error);
    }
  }

  /**
   * Suspend organization
   */
  static async suspendOrganization(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user.id;

      const organization = await organizationStore.getById(id);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const suspended = await organizationStore.suspend(id, reason, adminId);

      // Log the action
      await platformAuditLogStore.record({
        actorId: adminId,
        actorType: 'SYSTEM_ADMIN',
        action: 'ORG_SUSPENDED',
        targetType: 'ORGANIZATION',
        targetId: id,
        metadata: {
          organizationName: organization.name,
          ownerId: organization.ownerId,
          reason,
        },
      });

      // TODO: Send suspension notification email

      logger.info(`Organization suspended: ${id} by admin ${adminId}, reason: ${reason}`);

      res.json({
        success: true,
        message: 'Organization suspended',
        organization: sanitizeOrganization(suspended),
      });
    } catch (error) {
      logger.error('Suspend organization error:', error);
      next(error);
    }
  }

  /**
   * Reactivate suspended organization
   */
  static async activateOrganization(req, res, next) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      const organization = await organizationStore.getById(id);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const activated = await organizationStore.activate(id);

      // Log the action
      await platformAuditLogStore.record({
        actorId: adminId,
        actorType: 'SYSTEM_ADMIN',
        action: 'ORG_ACTIVATED',
        targetType: 'ORGANIZATION',
        targetId: id,
        metadata: {
          organizationName: organization.name,
          ownerId: organization.ownerId,
        },
      });

      // TODO: Send reactivation email

      logger.info(`Organization activated: ${id} by admin ${adminId}`);

      res.json({
        success: true,
        message: 'Organization activated',
        organization: sanitizeOrganization(activated),
      });
    } catch (error) {
      logger.error('Activate organization error:', error);
      next(error);
    }
  }

  /**
   * Get system settings
   */
  static async getMaintenanceStatus(req, res, next) {
    try {
      const settings = await systemSettingsStore.get();
      res.json({
        success: true,
        maintenanceMode: settings?.maintenanceMode || false,
      });
    } catch (error) {
      logger.error('Get maintenance status error:', error);
      // On error, return false (no maintenance mode)
      res.json({
        success: true,
        maintenanceMode: false,
      });
    }
  }

  static async getSettings(req, res, next) {
    try {
      const settings = await systemSettingsStore.get();
      res.json({
        success: true,
        settings,
      });
    } catch (error) {
      logger.error('Get settings error:', error);
      next(error);
    }
  }

  /**
   * Update system settings
   */
  static async updateSettings(req, res, next) {
    try {
      const adminId = req.user.id;
      const updates = req.body;

      const settings = await systemSettingsStore.update(updates, adminId);

      // Log the action
      await platformAuditLogStore.record({
        actorId: adminId,
        actorType: 'SYSTEM_ADMIN',
        action: 'SETTINGS_UPDATED',
        targetType: 'SETTINGS',
        targetId: 'global',
        metadata: { updates },
      });

      logger.info(`System settings updated by admin ${adminId}`);

      res.json({
        success: true,
        settings,
      });
    } catch (error) {
      logger.error('Update settings error:', error);
      next(error);
    }
  }

  /**
   * Get platform audit logs
   */
  static async getAuditLogs(req, res, next) {
    try {
      const { limit = 100, offset = 0 } = req.query;

      const logs = await platformAuditLogStore.list(parseInt(limit), parseInt(offset));

      // Enrich with actor information
      const actorIds = logs.map((log) => log.actorId).filter(Boolean);
      const actors = await userStore.getSummaries(actorIds);

      const enriched = logs.map((log) => ({
        ...log,
        actor: actors.get(log.actorId) || null,
      }));

      res.json({
        success: true,
        logs: enriched,
        total: enriched.length,
      });
    } catch (error) {
      logger.error('Get audit logs error:', error);
      next(error);
    }
  }

  /**
   * Get platform statistics
   */
  static async getStats(req, res, next) {
    try {
      const allOrgs = await organizationStore.listAll(1000, 0);
      const pendingOrgs = allOrgs.filter((o) => o.status === 'PENDING');
      const approvedOrgs = allOrgs.filter((o) => o.status === 'APPROVED');
      const rejectedOrgs = allOrgs.filter((o) => o.status === 'REJECTED');
      const suspendedOrgs = allOrgs.filter((o) => o.status === 'SUSPENDED');

      // Get recent activity
      const recentLogs = await platformAuditLogStore.list(10, 0);
      
      // Enrich with actor information
      const actorIds = recentLogs.map((log) => log.actorId).filter(Boolean);
      const actors = actorIds.length > 0 ? await userStore.getSummaries(actorIds) : new Map();
      
      const enrichedLogs = recentLogs.map((log) => ({
        ...log,
        actor: actors.get(log.actorId) || null,
        timestamp: log.createdAt, // Add timestamp alias for compatibility
      }));

      res.json({
        success: true,
        stats: {
          organizations: {
            total: allOrgs.length,
            pending: pendingOrgs.length,
            approved: approvedOrgs.length,
            rejected: rejectedOrgs.length,
            suspended: suspendedOrgs.length,
          },
          recentActivity: enrichedLogs,
        },
      });
    } catch (error) {
      logger.error('Get stats error:', error);
      next(error);
    }
  }

  static async registerLiveChatAdmin(req, res, next) {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      await ensureRealtimeAdmin({
        uid: adminUser.id,
        email: adminUser.email,
        fullName: adminUser.fullName,
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Register live chat admin error:', error);
      next(error);
    }
  }

  /**
   * List all users (with filters)
   */
  static async listUsers(req, res, next) {
    try {
      const { accountType, limit = 100 } = req.query;

      // This is a basic implementation - in production, you'd want pagination
      // and more sophisticated filtering
      // For now, we'll return a limited subset
      
      res.json({
        success: true,
        users: [],
        message: 'User listing requires additional implementation for production use',
      });
    } catch (error) {
      logger.error('List users error:', error);
      next(error);
    }
  }
}

