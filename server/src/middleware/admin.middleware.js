import logger from '../utils/logger.js';

/**
 * Middleware to check if user is a system admin
 */
export function requireSystemAdmin(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.accountType !== 'SYSTEM_ADMIN') {
      logger.warn(`Unauthorized system admin access attempt by user ${req.user.id}`);
      return res.status(403).json({ error: 'System administrator access required' });
    }

    next();
  } catch (error) {
    logger.error('System admin middleware error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

/**
 * Middleware to check if organization is approved
 */
export function requireApprovedOrganization(req, res, next) {
  try {
    const organizationContext = req.user?.organizationContext;

    if (!organizationContext || !organizationContext.organization) {
      return res.status(403).json({ 
        error: 'Organization access required',
        code: 'NO_ORGANIZATION' 
      });
    }

    const orgStatus = organizationContext.organization.status;

    if (orgStatus === 'PENDING') {
      return res.status(403).json({
        error: 'Organization pending approval. Please wait for system administrator review.',
        code: 'ORG_PENDING',
        organizationId: organizationContext.organization.id,
      });
    }

    if (orgStatus === 'REJECTED') {
      return res.status(403).json({
        error: 'Organization access has been rejected. Submit a re-review request from the registration status page.',
        code: 'ORG_REJECTED',
        reason: organizationContext.organization.rejectedReason || 'Not specified',
      });
    }

    if (orgStatus === 'SUSPENDED') {
      return res.status(403).json({
        error: 'Organization access has been suspended. Please contact support.',
        code: 'ORG_SUSPENDED',
        reason: organizationContext.organization.suspensionReason || 'Not specified',
      });
    }

    if (orgStatus !== 'APPROVED') {
      return res.status(403).json({
        error: 'Organization access is restricted',
        code: 'ORG_RESTRICTED',
      });
    }

    next();
  } catch (error) {
    logger.error('Organization approval check error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

/**
 * Middleware to allow view-only access for pending organizations
 * Use this for routes that should be accessible even when pending
 */
export function allowPendingOrganization(req, res, next) {
  try {
    const organizationContext = req.user?.organizationContext;

    if (!organizationContext || !organizationContext.organization) {
      return res.status(403).json({ 
        error: 'Organization access required',
        code: 'NO_ORGANIZATION' 
      });
    }

    const orgStatus = organizationContext.organization.status;

    // Allow PENDING and APPROVED
    if (orgStatus === 'PENDING' || orgStatus === 'APPROVED') {
      return next();
    }

    if (orgStatus === 'REJECTED') {
      return res.status(403).json({
        error: 'Organization access has been rejected. Submit a re-review request from the registration status page.',
        code: 'ORG_REJECTED',
        reason: organizationContext.organization.rejectedReason || 'Not specified',
      });
    }

    if (orgStatus === 'SUSPENDED') {
      return res.status(403).json({
        error: 'Organization access has been suspended. Please contact support.',
        code: 'ORG_SUSPENDED',
        reason: organizationContext.organization.suspensionReason || 'Not specified',
      });
    }

    next();
  } catch (error) {
    logger.error('Organization check error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

