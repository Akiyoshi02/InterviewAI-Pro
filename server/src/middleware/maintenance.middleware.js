import { systemSettingsStore } from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';

/**
 * Middleware to check maintenance mode
 * System admins can bypass maintenance mode
 * Non-admin users are blocked from write operations when maintenance mode is enabled
 * Read operations are allowed but maintenance flag is added to response
 * 
 * NOTE: This middleware should run AFTER authentication middleware
 * so that req.user is available to check if user is system admin
 */
export async function checkMaintenanceMode(req, res, next) {
  try {
    // Allow system admins to bypass maintenance mode completely
    if (req.user?.accountType === 'SYSTEM_ADMIN') {
      return next();
    }

    // Get system settings
    const settings = await systemSettingsStore.get();
    
    // If maintenance mode is not enabled, proceed normally
    if (!settings?.maintenanceMode) {
      return next();
    }

    // Maintenance mode is enabled - check if this is a write operation
    const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    const isWriteOperation = writeMethods.includes(req.method);

    if (isWriteOperation) {
      // Block write operations for non-admin users (both authenticated and unauthenticated)
      const userId = req.user?.id || req.user?.uid || 'unauthenticated';
      logger.warn(`Maintenance mode: Blocked ${req.method} ${req.path} for user ${userId}`);
      return res.status(503).json({
        error: 'The platform is currently under maintenance. Please try again later.',
        code: 'MAINTENANCE_MODE',
        maintenanceMode: true,
      });
    }

    // Allow read operations but add maintenance flag to response
    // This allows frontend to show maintenance banner
    res.locals.maintenanceMode = true;
    res.setHeader('X-Maintenance-Mode', 'true');
    return next();
  } catch (error) {
    logger.error('Maintenance mode check error:', error);
    // On error, allow request to proceed (fail open)
    // This prevents maintenance mode from breaking the system if settings can't be loaded
    return next();
  }
}

/**
 * Middleware to add maintenance mode status to response headers
 * This allows frontend to detect maintenance mode even on successful requests
 */
export function addMaintenanceHeader(req, res, next) {
  if (res.locals.maintenanceMode) {
    res.setHeader('X-Maintenance-Mode', 'true');
  }
  next();
}

