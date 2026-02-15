import { systemSettingsStore } from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';

const FEATURE_FLAGS_DEFAULTS = Object.freeze({
  enableJobPosting: true,
  enableInvitations: true,
  enableReviews: true,
  enableAnalytics: true,
});

const SETTINGS_CACHE_TTL_MS = 15 * 1000;

let settingsCache = {
  expiresAt: 0,
  value: FEATURE_FLAGS_DEFAULTS,
};

const normalizeFeatureFlags = (flags) => ({
  ...FEATURE_FLAGS_DEFAULTS,
  ...(flags && typeof flags === 'object' ? flags : {}),
});

export const getFeatureFlags = async ({ forceRefresh = false } = {}) => {
  const nowMs = Date.now();
  if (!forceRefresh && settingsCache.expiresAt > nowMs) {
    return settingsCache.value;
  }

  const settings = await systemSettingsStore.get();
  const normalized = normalizeFeatureFlags(settings?.featureFlags);
  settingsCache = {
    value: normalized,
    expiresAt: nowMs + SETTINGS_CACHE_TTL_MS,
  };
  return normalized;
};

export const clearFeatureFlagCache = () => {
  settingsCache = {
    value: FEATURE_FLAGS_DEFAULTS,
    expiresAt: 0,
  };
};

export const requireFeatureFlag = (
  flagKey,
  {
    allowSystemAdminBypass = true,
    disabledStatusCode = 503,
  } = {},
) => async (req, res, next) => {
  try {
    if (!flagKey || typeof flagKey !== 'string') {
      throw new Error('Feature flag key is required');
    }

    if (allowSystemAdminBypass && req.user?.accountType === 'SYSTEM_ADMIN') {
      return next();
    }

    const featureFlags = await getFeatureFlags();
    const isEnabled = featureFlags[flagKey] !== false;

    if (!isEnabled) {
      return res.status(disabledStatusCode).json({
        success: false,
        error: `${flagKey} is currently disabled by system administration.`,
        code: 'FEATURE_DISABLED',
        feature: flagKey,
      });
    }

    return next();
  } catch (error) {
    logger.warn(`Feature flag check failed for ${flagKey}; allowing request to proceed.`, error);
    return next();
  }
};

export default {
  getFeatureFlags,
  clearFeatureFlagCache,
  requireFeatureFlag,
};
