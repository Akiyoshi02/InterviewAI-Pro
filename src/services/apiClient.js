/**
 * Centralized API client for backend communication
 * Handles authentication, error handling, and API calls
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Get authentication token from Firebase
 */
async function getAuthToken() {
  try {
    const { authHelpers } = await import('../config/firebase.js');
    const token = await authHelpers.getAccessToken();
    if (!token) {
      console.warn('No auth token available from Firebase client');
    }
    return token;
  } catch (error) {
    console.error('Failed to get auth token from Firebase client:', error);
    return null;
  }
}

/**
 * Get headers with authentication
 */
async function getHeaders(includeAuth = true) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (includeAuth) {
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

/**
 * Handle API response
 */
async function handleResponse(response) {
  // Read response as text first (can always be converted to text)
  const text = await response.text();
  
  // Check if response is JSON
  const contentType = response.headers.get('content-type');
  let data;
  
  // If content-type indicates JSON, try to parse it
  if (contentType && contentType.includes('application/json')) {
    try {
      // Try to parse as JSON
      data = JSON.parse(text);
    } catch (jsonError) {
      // If JSON parsing fails, content-type was misleading
      // Use text as error message (e.g., rate limiter plain text)
      if (!response.ok) {
        throw new Error(text || `API Error: ${response.statusText}`);
      }
      // If response is ok but not valid JSON, return as message
      return { message: text, success: true };
    }
  } else {
    // Response is not JSON (e.g., plain text from rate limiter)
    // If no content-type or content-type doesn't indicate JSON,
    // try to parse as JSON anyway (in case it's missing header but is JSON)
    // but if it fails, use as plain text
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
        data = JSON.parse(text);
      } catch (jsonError) {
        // Not JSON, treat as plain text
        data = null;
      }
    }
    
    if (!data) {
      // Not JSON, treat as plain text
      if (!response.ok) {
        throw new Error(text || `API Error: ${response.statusText}`);
      }
      return { message: text, success: true };
    }
  }

  if (!response.ok) {
    // Special handling for 409 Conflict (user already exists) - return the user data
    if (response.status === 409 && data.user) {
      return { ...data, success: false, alreadyExists: true };
    }
    
    // Handle authentication errors (401/403) - clear session and redirect
    if (response.status === 401 || response.status === 403) {
      console.error('Authentication error detected, clearing session');
      
      // Check if error is about user not existing in Firebase auth
      const errorMsg = data.error || data.message || text || '';
      if (errorMsg.includes('user_not_found') || errorMsg.includes('JWT') || errorMsg.includes('token')) {
        // Clear all auth data
        try {
          const { authHelpers } = await import('../config/firebase.js');
          await authHelpers.signOut();
        } catch (e) {
          console.error('Failed to sign out:', e);
        }
        
        // Clear localStorage
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('socialAuthVerified');
        localStorage.removeItem('socialAuthData');
        
        // Clear Firebase localStorage keys (if any)
        const firebaseKeys = Object.keys(localStorage).filter(k => 
          /firebase/i.test(k)
        );
        firebaseKeys.forEach(key => localStorage.removeItem(key));
        
        // Redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
    
    throw new Error(data.error || data.message || text || `API Error: ${response.statusText}`);
  }

  return data;
}

/**
 * API Client methods
 */
export const apiClient = {
  /**
   * Authentication APIs
   */
  auth: {
    async register(userData) {
      const isFormDataPayload = typeof FormData !== 'undefined' && userData instanceof FormData;
      let headers;
      let body;

      if (isFormDataPayload) {
        const token = await getAuthToken();
        headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        body = userData;
      } else {
        headers = await getHeaders();
        body = JSON.stringify(userData);
      }

      console.log('Register API call:', {
        url: `${API_URL}/api/auth/register`,
        hasAuth: !!headers?.Authorization,
        isMultipart: isFormDataPayload,
      });
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers,
        body,
      });
      console.log('Register API response status:', response.status, response.statusText);
      return handleResponse(response);
    },

    async checkEmailAvailability(email) {
      const response = await fetch(`${API_URL}/api/auth/check-email`, {
        method: 'POST',
        headers: await getHeaders(false),
        body: JSON.stringify({ email }),
      });
      return handleResponse(response);
    },

    async getMe() {
      const headers = await getHeaders();
      console.log('getMe API call:', {
        url: `${API_URL}/api/auth/me`,
        hasAuth: !!headers['Authorization'],
      });
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'GET',
        headers,
      });
      console.log('getMe API response status:', response.status, response.statusText);
      return handleResponse(response);
    },
    async updateMe(payload) {
      const headers = await getHeaders();
      console.log('updateMe API call:', {
        url: `${API_URL}/api/auth/me`,
        hasAuth: !!headers['Authorization'],
        data: payload,
      });
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      console.log('updateMe API response status:', response.status, response.statusText);
      return handleResponse(response);
    },

    // Alias for updateMe
    async updateProfile(payload) {
      return this.updateMe(payload);
    },

    async deleteUnregisteredAuthUser(userId) {
      const headers = await getHeaders(false); // Don't include auth since user isn't registered
      console.log('deleteUnregisteredAuthUser API call:', {
        url: `${API_URL}/api/auth/delete-unregistered-auth-user`,
        userId,
      });
      
      try {
        const response = await fetch(`${API_URL}/api/auth/delete-unregistered-auth-user`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ userId }),
        });
        console.log('deleteUnregisteredAuthUser API response status:', response.status, response.statusText);
        const result = await handleResponse(response);
        console.log('deleteUnregisteredAuthUser API result:', result);
        return result;
      } catch (error) {
        console.error('deleteUnregisteredAuthUser API error:', error);
        throw error;
      }
    },
  },

  uploads: {
    async moderateProfilePhoto(file) {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/uploads/moderate/profile-photo`, {
        method: 'POST',
        body: formData,
      });

      return handleResponse(response);
    },

    async moderateCompanyLogo(file) {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/uploads/moderate/company-logo`, {
        method: 'POST',
        body: formData,
      });

      return handleResponse(response);
    },
  },

  /**
   * Interview APIs
   */
  interviews: {
    async create(interviewData) {
      const response = await fetch(`${API_URL}/api/interviews/create`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(interviewData),
      });
      return handleResponse(response);
    },

    async getById(interviewId) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async start(interviewId) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/start`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async end(interviewId) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/end`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getMyInterviews() {
      const response = await fetch(`${API_URL}/api/interviews/user/my-interviews`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getCompanyInterviews() {
      const response = await fetch(`${API_URL}/api/interviews/company/all`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getEvaluation(interviewId) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/evaluation`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async markQuestionAsked(interviewId, questionId) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/question/asked`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ questionId }),
      });
      return handleResponse(response);
    },

    async submitAnswer(interviewId, questionId, answer, audioUrl = null) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/question/answer`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ questionId, answer, audioUrl }),
      });
      return handleResponse(response);
    },
  },

  /**
   * Analytics APIs
   */
  analytics: {
    async getDashboard() {
      const response = await fetch(`${API_URL}/api/analytics/dashboard`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getCompanyMetrics() {
      const response = await fetch(`${API_URL}/api/analytics/company/metrics`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },
  },

  /**
   * Video/WebRTC APIs
   */
  video: {
    async getConfig() {
      const response = await fetch(`${API_URL}/api/video/config`, {
        method: 'GET',
        headers: await getHeaders(false), // No auth needed
      });
      return handleResponse(response);
    },

    async createSession(interviewId) {
      const response = await fetch(`${API_URL}/api/video/session/${interviewId}`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getSession(interviewId) {
      const response = await fetch(`${API_URL}/api/video/session/${interviewId}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },
  },

  /**
   * Organization APIs
   */
  organizations: {
    async getMyOrganization() {
      const response = await fetch(`${API_URL}/api/organizations/me`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async updateMyOrganization(payload) {
      const response = await fetch(`${API_URL}/api/organizations/me`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async listMembers() {
      const response = await fetch(`${API_URL}/api/organizations/me/members`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async addMember(payload) {
      const response = await fetch(`${API_URL}/api/organizations/me/members`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },
  },

  /**
   * Job APIs
   */
  jobs: {
    async create(payload) {
      const response = await fetch(`${API_URL}/api/jobs`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async list() {
      const response = await fetch(`${API_URL}/api/jobs`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async get(jobId) {
      const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async update(jobId, payload) {
      const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async listPublic(limit = 20) {
      const response = await fetch(`${API_URL}/api/public/jobs?limit=${limit}`, {
        method: 'GET',
        headers: await getHeaders(false),
      });
      return handleResponse(response);
    },

    async getPublic(jobId) {
      const response = await fetch(`${API_URL}/api/public/jobs/${jobId}`, {
        method: 'GET',
        headers: await getHeaders(false),
      });
      return handleResponse(response);
    },
  },

  /**
   * Invitation APIs
   */
  invitations: {
    async create(payload) {
      const response = await fetch(`${API_URL}/api/invitations`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async list() {
      const response = await fetch(`${API_URL}/api/invitations`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async preview(token) {
      const response = await fetch(`${API_URL}/api/public/invitations/${token}`, {
        method: 'GET',
        headers: await getHeaders(false),
      });
      return handleResponse(response);
    },

    async accept(token) {
      const response = await fetch(`${API_URL}/api/invitations/accept`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ token }),
      });
      return handleResponse(response);
    },
  },

  /**
   * Pipeline APIs
   */
  pipeline: {
    async list() {
      const response = await fetch(`${API_URL}/api/pipeline`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async move(interviewId, payload) {
      const response = await fetch(`${API_URL}/api/pipeline/${interviewId}`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },
  },

  /**
   * Review APIs
   */
  reviews: {
    async list(interviewId) {
      const response = await fetch(`${API_URL}/api/reviews/${interviewId}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async submit(interviewId, payload) {
      const response = await fetch(`${API_URL}/api/reviews/${interviewId}`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },
  },

  /**
   * Activity APIs
   */
  activity: {
    async list(limit = 50) {
      const response = await fetch(`${API_URL}/api/activity?limit=${limit}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },
  },
};

export default apiClient;

