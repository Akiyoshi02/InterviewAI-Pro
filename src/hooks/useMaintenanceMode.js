import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

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
    // System admins bypass maintenance mode
    if (accountType === 'SYSTEM_ADMIN') {
      setMaintenanceMode(false);
      setLoading(false);
      return;
    }

    // Check maintenance mode from public endpoint
    const checkMaintenanceMode = async () => {
      try {
        const response = await fetch(`${API_URL}/api/public/maintenance-status`);
        const data = await response.json();
        
        if (data.success && data.maintenanceMode) {
          setMaintenanceMode(true);
        } else {
          setMaintenanceMode(false);
        }
      } catch (error) {
        // If we can't check, assume no maintenance mode
        setMaintenanceMode(false);
      } finally {
        setLoading(false);
      }
    };

    // Initial check
    checkMaintenanceMode();

    // Poll every 30 seconds to check for maintenance mode changes
    const interval = setInterval(checkMaintenanceMode, 30000);

    return () => clearInterval(interval);
  }, [accountType]); // Only depend on accountType, not entire user object

  return { maintenanceMode, loading };
};
