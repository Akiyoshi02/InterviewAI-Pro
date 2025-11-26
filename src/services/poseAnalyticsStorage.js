/**
 * Pose Analytics Storage Service
 * Stores and retrieves pose detection analytics in localStorage
 * 100% FREE - No backend or database required
 */

const STORAGE_KEY_PREFIX = 'pose_analytics_';
const STORAGE_KEY_SUMMARY = 'pose_analytics_summary';
const STORAGE_KEY_SESSION = 'pose_analytics_session';

/**
 * Save pose metrics snapshot during interview
 * @param {string} interviewId - Unique interview identifier
 * @param {Object} metrics - Current pose metrics
 */
export const savePoseSnapshot = (interviewId, metrics) => {
  try {
    const storageKey = `${STORAGE_KEY_PREFIX}${interviewId}`;
    
    // Get existing snapshots
    const existingData = localStorage.getItem(storageKey);
    const snapshots = existingData ? JSON.parse(existingData) : [];
    
    // Add new snapshot with timestamp
    snapshots.push({
      timestamp: Date.now(),
      ...metrics,
    });
    
    // Save back to localStorage
    localStorage.setItem(storageKey, JSON.stringify(snapshots));
    
    return true;
  } catch (error) {
    console.error('Failed to save pose snapshot:', error);
    return false;
  }
};

/**
 * Calculate average metrics from all snapshots
 * @param {Array} snapshots - Array of pose metric snapshots
 * @returns {Object} Averaged metrics
 */
const calculateAverages = (snapshots) => {
  if (!snapshots || snapshots.length === 0) {
    return {
      averageConfidence: 0,
      averagePostureScore: 0,
      totalSnapshots: 0,
    };
  }

  const totals = snapshots.reduce((acc, snapshot) => {
    return {
      confidence: acc.confidence + (snapshot.confidence || 0),
      postureScore: acc.postureScore + (snapshot.postureScore || 0),
      slouching: acc.slouching + (snapshot.slouching ? 1 : 0),
      fidgeting: acc.fidgeting + (snapshot.fidgeting ? 1 : 0),
      goodEyeContact: acc.goodEyeContact + (snapshot.eyeContact === 'good' ? 1 : 0),
      goodPosture: acc.goodPosture + (snapshot.posture === 'good' ? 1 : 0),
      centeredHead: acc.centeredHead + (snapshot.headPosition === 'centered' ? 1 : 0),
    };
  }, {
    confidence: 0,
    postureScore: 0,
    slouching: 0,
    fidgeting: 0,
    goodEyeContact: 0,
    goodPosture: 0,
    centeredHead: 0,
  });

  const count = snapshots.length;

  return {
    averageConfidence: Math.round(totals.confidence / count),
    averagePostureScore: Math.round(totals.postureScore / count),
    slouchingPercentage: Math.round((totals.slouching / count) * 100),
    fidgetingPercentage: Math.round((totals.fidgeting / count) * 100),
    eyeContactPercentage: Math.round((totals.goodEyeContact / count) * 100),
    goodPosturePercentage: Math.round((totals.goodPosture / count) * 100),
    centeredHeadPercentage: Math.round((totals.centeredHead / count) * 100),
    totalSnapshots: count,
    duration: snapshots[snapshots.length - 1]?.timestamp - snapshots[0]?.timestamp,
  };
};

/**
 * Get pose analytics summary for an interview
 * @param {string} interviewId - Interview identifier
 * @returns {Object} Analytics summary
 */
export const getPoseAnalyticsSummary = (interviewId) => {
  try {
    const storageKey = `${STORAGE_KEY_PREFIX}${interviewId}`;
    const data = localStorage.getItem(storageKey);
    
    if (!data) {
      return null;
    }
    
    const snapshots = JSON.parse(data);
    return calculateAverages(snapshots);
  } catch (error) {
    console.error('Failed to get pose analytics summary:', error);
    return null;
  }
};

/**
 * Get all pose snapshots for an interview
 * @param {string} interviewId - Interview identifier
 * @returns {Array} All pose snapshots
 */
export const getPoseSnapshots = (interviewId) => {
  try {
    const storageKey = `${STORAGE_KEY_PREFIX}${interviewId}`;
    const data = localStorage.getItem(storageKey);
    
    if (!data) {
      return [];
    }
    
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to get pose snapshots:', error);
    return [];
  }
};

/**
 * Save final pose analytics summary after interview completion
 * @param {string} interviewId - Interview identifier
 * @param {Object} additionalData - Additional metadata
 */
export const finalizePoseAnalytics = (interviewId, additionalData = {}) => {
  try {
    const summary = getPoseAnalyticsSummary(interviewId);
    
    if (!summary) {
      return null;
    }
    
    const finalSummary = {
      interviewId,
      ...summary,
      ...additionalData,
      completedAt: Date.now(),
    };
    
    // Save summary separately for easy retrieval
    const summaryKey = `${STORAGE_KEY_SUMMARY}_${interviewId}`;
    localStorage.setItem(summaryKey, JSON.stringify(finalSummary));
    
    return finalSummary;
  } catch (error) {
    console.error('Failed to finalize pose analytics:', error);
    return null;
  }
};

/**
 * Get final summary for an interview
 * @param {string} interviewId - Interview identifier
 */
export const getFinalSummary = (interviewId) => {
  try {
    const summaryKey = `${STORAGE_KEY_SUMMARY}_${interviewId}`;
    const data = localStorage.getItem(summaryKey);
    
    if (!data) {
      return null;
    }
    
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to get final summary:', error);
    return null;
  }
};

/**
 * Save current session pose analytics (for active session)
 * @param {Object} sessionData - Current session data
 */
export const saveSessionPoseData = (sessionData) => {
  try {
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessionData));
    return true;
  } catch (error) {
    console.error('Failed to save session pose data:', error);
    return false;
  }
};

/**
 * Get current session pose analytics
 * @returns {Object} Current session data
 */
export const getSessionPoseData = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_SESSION);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get session pose data:', error);
    return null;
  }
};

/**
 * Clear session pose data (call on session end)
 */
export const clearSessionPoseData = () => {
  try {
    localStorage.removeItem(STORAGE_KEY_SESSION);
    return true;
  } catch (error) {
    console.error('Failed to clear session pose data:', error);
    return false;
  }
};

/**
 * Delete pose analytics for an interview
 * @param {string} interviewId - Interview identifier
 */
export const deletePoseAnalytics = (interviewId) => {
  try {
    const storageKey = `${STORAGE_KEY_PREFIX}${interviewId}`;
    const summaryKey = `${STORAGE_KEY_SUMMARY}_${interviewId}`;
    
    localStorage.removeItem(storageKey);
    localStorage.removeItem(summaryKey);
    
    return true;
  } catch (error) {
    console.error('Failed to delete pose analytics:', error);
    return false;
  }
};

/**
 * Get all interview IDs with pose analytics
 * @returns {Array} Array of interview IDs
 */
export const getAllInterviewsWithPoseData = () => {
  try {
    const keys = Object.keys(localStorage);
    const interviewIds = keys
      .filter(key => key.startsWith(STORAGE_KEY_PREFIX))
      .map(key => key.replace(STORAGE_KEY_PREFIX, ''));
    
    return interviewIds;
  } catch (error) {
    console.error('Failed to get all interviews with pose data:', error);
    return [];
  }
};

/**
 * Clear all pose analytics data (cleanup utility)
 */
export const clearAllPoseAnalytics = () => {
  try {
    const keys = Object.keys(localStorage);
    const poseKeys = keys.filter(
      key => key.startsWith(STORAGE_KEY_PREFIX) || 
             key.startsWith(STORAGE_KEY_SUMMARY) ||
             key === STORAGE_KEY_SESSION
    );
    
    poseKeys.forEach(key => localStorage.removeItem(key));
    
    return true;
  } catch (error) {
    console.error('Failed to clear all pose analytics:', error);
    return false;
  }
};

/**
 * Get storage usage statistics
 * @returns {Object} Storage statistics
 */
export const getStorageStats = () => {
  try {
    const interviews = getAllInterviewsWithPoseData();
    let totalSnapshots = 0;
    let totalSize = 0;
    
    interviews.forEach(interviewId => {
      const storageKey = `${STORAGE_KEY_PREFIX}${interviewId}`;
      const data = localStorage.getItem(storageKey);
      if (data) {
        totalSnapshots += JSON.parse(data).length;
        totalSize += data.length;
      }
    });
    
    return {
      interviewCount: interviews.length,
      totalSnapshots,
      estimatedSizeKB: Math.round(totalSize / 1024),
    };
  } catch (error) {
    console.error('Failed to get storage stats:', error);
    return {
      interviewCount: 0,
      totalSnapshots: 0,
      estimatedSizeKB: 0,
    };
  }
};

export default {
  savePoseSnapshot,
  getPoseAnalyticsSummary,
  getPoseSnapshots,
  finalizePoseAnalytics,
  getFinalSummary,
  saveSessionPoseData,
  getSessionPoseData,
  clearSessionPoseData,
  deletePoseAnalytics,
  getAllInterviewsWithPoseData,
  clearAllPoseAnalytics,
  getStorageStats,
};
