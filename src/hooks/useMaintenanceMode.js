import { useState, useEffect, useMemo } from 'react';
import { onValue, ref as dbRef } from 'firebase/database';
import { useAuth } from '../contexts/AuthContext';
import { realtimeDb } from '../config/firebase.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Hook to check maintenance mode status
 * System admins always return false (no maintenance mode for them)
 * 
 * FIXED: Changed dependency from entire `user` object to `accountType` to prevent
 * unnecessary re-runs when the user object reference changes (which was causing
 * excessive API calls). Now the effect only re-runs when the account type actually changes.
 */
export const useMaintenanceMode = () => {
  const { user } = useAuth();
  // Use memoized accountType instead of depending on the entire user object
  // This prevents the effect from re-running when user object reference changes
  const accountType = useMemo(() => user?.accountType, [user?.accountType]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubRealtime = null;
    let isCancelled = false;

    // System admins bypass maintenance mode
    if (accountType === 'SYSTEM_ADMIN') {
      setMaintenanceMode(false);
      setLoading(false);
      return;
    }

    const checkMaintenanceModeViaHttp = async () => {
      try {
        const response = await fetch(`${API_URL}/api/public/maintenance-status`);
        const data = await response.json();
        if (!isCancelled) {
          setMaintenanceMode(Boolean(data.success && data.maintenanceMode));
          setLoading(false);
        }
      } catch (error) {
        // If we can't check, assume no maintenance mode
        if (!isCancelled) {
          setMaintenanceMode(false);
          setLoading(false);
        }
      }
    };

    try {
      // Prefer realtime subscription for instant maintenance mode updates
      if (realtimeDb) {
        const settingsRef = dbRef(realtimeDb, 'public/systemSettings');
        unsubRealtime = onValue(
          settingsRef,
          (snapshot) => {
            const data = snapshot.val();
            if (data && typeof data.maintenanceMode === 'boolean') {
              setMaintenanceMode(Boolean(data.maintenanceMode));
              setLoading(false);
              return;
            }

            // Fallback if public settings are not available in RTDB
            void checkMaintenanceModeViaHttp();
          },
          () => {
            // Fallback to HTTP if realtime subscription fails
            void checkMaintenanceModeViaHttp();
          },
        );
      } else {
        void checkMaintenanceModeViaHttp();
      }
    } catch {
      void checkMaintenanceModeViaHttp();
    }

    return () => {
      isCancelled = true;
      if (typeof unsubRealtime === 'function') {
        unsubRealtime();
      }
    };
  }, [accountType]); // Only depend on accountType, not entire user object

  return { maintenanceMode, loading };
};
