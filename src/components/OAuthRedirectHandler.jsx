import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Component to handle OAuth redirects that might land on any page
 * This ensures OAuth callbacks are always redirected to verify-email
 */
const OAuthRedirectHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if current URL has OAuth callback tokens
    const hash = window.location.hash;
    const currentPath = location.pathname;
    
    // If we have an access_token in the hash and we're not already on verify-email
    if (hash && hash.includes('access_token') && currentPath !== '/verify-email') {
      console.log(`OAuth callback detected on ${currentPath}, redirecting to verify-email`);
      // Redirect to verify-email with the hash
      navigate(`/verify-email${hash}`, { replace: true });
    }
  }, [navigate, location]);

  return null; // This component doesn't render anything
};

export default OAuthRedirectHandler;
