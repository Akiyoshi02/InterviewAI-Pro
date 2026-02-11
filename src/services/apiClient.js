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
    
    // Special handling for 503 Service Unavailable (maintenance mode)
    if (response.status === 503 && data.code === 'MAINTENANCE_MODE') {
      const error = new Error(data.error || 'The platform is currently under maintenance. Please try again later.');
      error.code = 'MAINTENANCE_MODE';
      error.maintenanceMode = true;
      throw error;
    }
    
    // For validation errors (400), include the errors array in the thrown error
    if (response.status === 400 && data.errors) {
      const error = new Error(data.error || 'Validation failed');
      error.errors = data.errors;
      error.error = data.error;
      throw error;
    }
    
    // Handle authentication errors (401/403) - clear session and redirect
    // BUT: Don't treat business logic 403 errors (like organization status) as auth errors
    if (response.status === 401 || response.status === 403) {
      // Check if this is a business logic error (organization status, etc.) or an actual auth error
      const errorCode = data.code || '';
      const errorMsg = data.error || data.message || text || '';
      
      // Business logic error codes that should NOT trigger session clearing
      const businessLogicErrorCodes = [
        'ORG_PENDING',
        'ORG_REJECTED',
        'ORG_SUSPENDED',
        'ORG_RESTRICTED',
        'NO_ORGANIZATION'
      ];
      
      // Check if this is a business logic error (only applies to 403, not 401)
      const isBusinessLogicError = response.status === 403 && (
        businessLogicErrorCodes.includes(errorCode) ||
        errorMsg.includes('Organization pending approval') ||
        errorMsg.includes('Organization access has been') ||
        errorMsg.includes('Organization access is restricted') ||
        errorMsg.includes('Organization access required')
      );
      
      // 401 errors are always authentication errors (unless somehow they're business logic, which shouldn't happen)
      // For 403, only treat as auth error if it's NOT a business logic error AND it contains auth-related keywords
      const isAuthError = response.status === 401 || (
        response.status === 403 && 
        !isBusinessLogicError &&
        (errorMsg.includes('user_not_found') || 
         errorMsg.includes('JWT') || 
         errorMsg.includes('token') ||
         errorMsg.includes('Unauthorized') ||
         errorMsg.includes('authentication'))
      );
      
      if (isAuthError) {
        console.error('Authentication error detected, clearing session');
        
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
          const currentPath = `${window.location.pathname}${window.location.search || ''}`;
          const safeRedirect =
            currentPath &&
            currentPath.startsWith('/') &&
            !currentPath.startsWith('//') &&
            !currentPath.startsWith('/login') &&
            !currentPath.startsWith('/register');
          window.location.href = safeRedirect
            ? `/login?redirect=${encodeURIComponent(currentPath)}`
            : '/login';
        }
      }
      // If it's a business logic error, just throw the error without clearing session
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

    async startEmailVerification({ email, fullName } = {}) {
      const response = await fetch(`${API_URL}/api/auth/email-verification/start`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ email, fullName }),
      });
      return handleResponse(response);
    },

    async verifyEmailCode(code) {
      const response = await fetch(`${API_URL}/api/auth/email-verification/verify-code`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ code }),
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

    async updateProfilePhoto(file) {
      const formData = new FormData();
      formData.append('profilePhoto', file);

      const token = await getAuthToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/auth/me/profile-photo`, {
        method: 'PATCH',
        headers,
        body: formData,
      });
      return handleResponse(response);
    },

    async updateCompanyLogo(file) {
      const formData = new FormData();
      formData.append('companyLogo', file);

      const token = await getAuthToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/auth/me/company-logo`, {
        method: 'PATCH',
        headers,
        body: formData,
      });
      return handleResponse(response);
    },

    async updateCompanyProof(file) {
      const formData = new FormData();
      formData.append('companyProof', file);

      const token = await getAuthToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/auth/me/company-proof`, {
        method: 'PATCH',
        headers,
        body: formData,
      });
      return handleResponse(response);
    },

    async updateResume(file) {
      const formData = new FormData();
      formData.append('resumeFile', file);

      const token = await getAuthToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/auth/me/resume`, {
        method: 'PATCH',
        headers,
        body: formData,
      });
      return handleResponse(response);
    },

    async requestOrganizationReReview(note) {
      const response = await fetch(`${API_URL}/api/auth/me/organization/request-rereview`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ note }),
      });
      return handleResponse(response);
    },

    async deleteUnregisteredAuthUser(userId) {
      const headers = await getHeaders(true); // Must include Firebase auth token (user may not exist in DB yet)
      console.log('deleteUnregisteredAuthUser API call:', {
        url: `${API_URL}/api/auth/delete-unregistered-auth-user`,
        userId,
        hasAuth: !!headers['Authorization'],
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

    async moderateResume(file, metadata = {}) {
      const formData = new FormData();
      formData.append('resumeFile', file);
      Object.entries(metadata || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          formData.append(key, value);
        }
      });

      const response = await fetch(`${API_URL}/api/uploads/moderate/resume`, {
        method: 'POST',
        body: formData,
      });

      return handleResponse(response);
    },

    async moderateCompanyProof(file, metadata = {}) {
      const formData = new FormData();
      formData.append('companyProof', file);
      Object.entries(metadata || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          formData.append(key, value);
        }
      });

      const response = await fetch(`${API_URL}/api/uploads/moderate/company-proof`, {
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

    // Alias for getById for better readability
    async getInterview(interviewId) {
      return this.getById(interviewId);
    },

    async recordRecordingConsent(interviewId, { recordingConsentGivenAt, recordingConsentVersion }) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/recording-consent`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify({
          recordingConsentGivenAt: recordingConsentGivenAt || new Date().toISOString(),
          recordingConsentVersion: recordingConsentVersion || null,
        }),
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

    /**
     * Get dashboard metrics with historical comparison (week-over-week changes)
     * Returns metrics like activeJobPostings, pendingReviews, upcomingInterviews
     * with changeText and changeType for displaying trends
     */
    async getDashboardMetrics() {
      const response = await fetch(`${API_URL}/api/analytics/dashboard-metrics`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    /**
     * Get historical metrics snapshots for trend analysis (company)
     * @param {number} days - Number of days of history (max 30)
     */
    async getHistoricalMetrics(days = 7) {
      const response = await fetch(`${API_URL}/api/analytics/historical?days=${days}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    /**
     * Get candidate dashboard metrics with historical comparison (week-over-week changes)
     * Returns metrics like completedInterviews, scheduledInterviews, averageScore, currentGrade
     * with changeText and changeType for displaying trends
     */
    async getCandidateDashboardMetrics() {
      const response = await fetch(`${API_URL}/api/analytics/candidate/dashboard-metrics`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    /**
     * Get candidate historical metrics snapshots for trend analysis
     * @param {number} days - Number of days of history (max 30)
     */
    async getCandidateHistoricalMetrics(days = 7) {
      const response = await fetch(`${API_URL}/api/analytics/candidate/historical?days=${days}`, {
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

    // Note: Inviting by email requires the user to already exist.
    // The backend's addMember requires userId, not email.
    // For proper invitation flow, you'd need an invitation system or
    // an endpoint to lookup userId by email.
    async invite(email, role = 'REVIEWER') {
      // Check if user exists first
      const emailCheck = await this.auth.checkEmailAvailability(email);
      if (!emailCheck.exists) {
        throw new Error('User with this email does not exist. They must register first.');
      }
      // Without a userId lookup endpoint, we can't proceed
      throw new Error('Invite by email requires user lookup functionality. Please use addMember with userId directly.');
    },

    async updateMemberRole(userId, role) {
      const response = await fetch(`${API_URL}/api/organizations/me/members`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ userId, role, status: 'ACTIVE' }),
      });
      return handleResponse(response);
    },

    async removeMember(userId) {
      // Since there's no DELETE endpoint, we'll set status to INACTIVE
      const response = await fetch(`${API_URL}/api/organizations/me/members`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ userId, status: 'INACTIVE' }),
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

    async getOrganizationJobs() {
      const response = await fetch(`${API_URL}/api/jobs`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async remove(jobId) {
      const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
        method: 'DELETE',
        headers: await getHeaders(),
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
   * Review APIs (SME calibration: AI vs human comparison, override)
   */
  reviews: {
    async list(interviewId) {
      const response = await fetch(`${API_URL}/api/reviews/${interviewId}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getReviewForInterview(interviewId) {
      const response = await fetch(`${API_URL}/api/reviews/${interviewId}/me`, {
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

    async submitReview({ interviewId, ...payload }) {
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

  /**
   * System Admin APIs
   */
  admin: {
    async seedAdmin(payload) {
      const response = await fetch(`${API_URL}/api/admin/auth/seed-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async getStats() {
      const response = await fetch(`${API_URL}/api/admin/stats`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getFairnessCalibration(limit = 500) {
      const response = await fetch(`${API_URL}/api/admin/fairness-calibration?limit=${limit}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async listOrganizations(status = null, limit = 100) {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('limit', limit);
      const response = await fetch(`${API_URL}/api/admin/organizations?${params}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async listPendingOrganizations(limit = 50) {
      const response = await fetch(`${API_URL}/api/admin/organizations/pending?limit=${limit}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getOrganization(id) {
      const response = await fetch(`${API_URL}/api/admin/organizations/${id}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async approveOrganization(id) {
      const response = await fetch(`${API_URL}/api/admin/organizations/${id}/approve`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async rejectOrganization(id, reasonOrPayload) {
      const payload =
        typeof reasonOrPayload === 'string'
          ? { reason: reasonOrPayload }
          : reasonOrPayload || {};

      const response = await fetch(`${API_URL}/api/admin/organizations/${id}/reject`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async suspendOrganization(id, reason) {
      const response = await fetch(`${API_URL}/api/admin/organizations/${id}/suspend`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ reason }),
      });
      return handleResponse(response);
    },

    async activateOrganization(id) {
      const response = await fetch(`${API_URL}/api/admin/organizations/${id}/activate`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getSettings() {
      const response = await fetch(`${API_URL}/api/admin/settings`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async updateSettings(settings) {
      const response = await fetch(`${API_URL}/api/admin/settings`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify(settings),
      });
      return handleResponse(response);
    },

    async getAuditLogs(limit = 100, offset = 0) {
      const response = await fetch(`${API_URL}/api/admin/audit-logs?limit=${limit}&offset=${offset}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async registerLiveChatAdmin() {
      const response = await fetch(`${API_URL}/api/admin/live-chat/register`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },
  },

  /**
   * Job Application APIs
   */
  applications: {
    async submit(jobId, payload) {
      const response = await fetch(`${API_URL}/api/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async getMyApplications() {
      const response = await fetch(`${API_URL}/api/candidates/applications`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getApplication(id) {
      const response = await fetch(`${API_URL}/api/applications/${id}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getJobApplications(jobId) {
      const response = await fetch(`${API_URL}/api/jobs/${jobId}/applications`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getOrganizationApplications(status = null, limit = 50) {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('limit', limit);
      const response = await fetch(`${API_URL}/api/organizations/applications?${params}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async updateStatus(id, status, reviewedBy = null) {
      const response = await fetch(`${API_URL}/api/applications/${id}`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify({ status, reviewedBy }),
      });
      return handleResponse(response);
    },

    async withdraw(id) {
      const response = await fetch(`${API_URL}/api/applications/${id}`, {
        method: 'DELETE',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },
  },

  templates: {
    async create(payload) {
      const response = await fetch(`${API_URL}/api/templates`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async list() {
      const response = await fetch(`${API_URL}/api/templates`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async listPublic() {
      const response = await fetch(`${API_URL}/api/templates/public`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async get(id) {
      const response = await fetch(`${API_URL}/api/templates/${id}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async update(id, payload) {
      const response = await fetch(`${API_URL}/api/templates/${id}`, {
        method: 'PUT',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async duplicate(id) {
      const response = await fetch(`${API_URL}/api/templates/${id}/duplicate`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async delete(id) {
      const response = await fetch(`${API_URL}/api/templates/${id}`, {
        method: 'DELETE',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },
  },

  // Team Invitations
  teamInvitations: {
    async send(email, role) {
      const response = await fetch(`${API_URL}/api/organizations/me/team-invitations`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ email, role }),
      });
      return handleResponse(response);
    },

    async list(status = null) {
      const url = status 
        ? `${API_URL}/api/organizations/me/team-invitations?status=${status}`
        : `${API_URL}/api/organizations/me/team-invitations`;
      const response = await fetch(url, {
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getByToken(token) {
      const response = await fetch(`${API_URL}/api/public/team-invitations/${token}`, {
        headers: await getHeaders(false), // Public endpoint, no auth
      });
      return handleResponse(response);
    },

    async revoke(id) {
      const response = await fetch(`${API_URL}/api/organizations/me/team-invitations/${id}`, {
        method: 'DELETE',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async resend(id) {
      const response = await fetch(`${API_URL}/api/organizations/me/team-invitations/${id}/resend`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },
  },

  /**
   * Newsletter APIs
   */
  newsletter: {
    async subscribe(email) {
      const response = await fetch(`${API_URL}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: await getHeaders(false), // Public endpoint, no auth required
        body: JSON.stringify({ email }),
      });
      return handleResponse(response);
    },

    async unsubscribe(email) {
      const response = await fetch(`${API_URL}/api/newsletter/unsubscribe`, {
        method: 'POST',
        headers: await getHeaders(false), // Public endpoint, no auth required
        body: JSON.stringify({ email }),
      });
      return handleResponse(response);
    },
  },

  /**
   * Contact APIs
   */
  contact: {
    async send(payload) {
      const response = await fetch(`${API_URL}/api/public/contact`, {
        method: 'POST',
        headers: await getHeaders(false), // Public endpoint, no auth required
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },
  },

  /**
   * Training Dataset APIs
   * For collecting and exporting LLM and analytics training data
   */
  datasets: {
    /**
     * Save interview training dataset (conversation Q&A pairs)
     */
    async saveInterview(payload) {
      const response = await fetch(`${API_URL}/api/datasets/interview`, {
        method: 'POST',
        headers: await getHeaders(), // Optional auth
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    /**
     * Save analytics training dataset (posture/face-mesh data)
     */
    async saveAnalytics(payload) {
      const response = await fetch(`${API_URL}/api/datasets/analytics`, {
        method: 'POST',
        headers: await getHeaders(), // Optional auth
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    /**
     * List all datasets (admin only)
     * @param {string} type - 'all', 'interview', or 'analytics'
     * @param {number} limit - Number of results
     * @param {number} offset - Pagination offset
     */
    async list(type = 'all', limit = 50, offset = 0) {
      const params = new URLSearchParams({ type, limit, offset });
      const response = await fetch(`${API_URL}/api/datasets?${params}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    /**
     * Get dataset statistics (admin only)
     */
    async getStatistics() {
      const response = await fetch(`${API_URL}/api/datasets/statistics`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    /**
     * Export datasets in training format (admin only)
     * @param {string} type - 'interview' or 'analytics'
     * @param {string} format - 'jsonl' or 'json'
     * @param {number} minQuality - Minimum quality score filter
     */
    async export(type, format = 'jsonl', minQuality = 0) {
      const params = new URLSearchParams({ format, minQuality });
      const response = await fetch(`${API_URL}/api/datasets/export/${type}?${params}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      
      // For JSONL format, return text content for download
      if (format === 'jsonl') {
        const text = await response.text();
        return { success: true, content: text, format: 'jsonl' };
      }
      
      return handleResponse(response);
    },

    /**
     * Delete a dataset (admin only)
     * @param {string} id - Dataset ID
     * @param {string} type - 'interview' or 'analytics'
     */
    async delete(id, type) {
      const response = await fetch(`${API_URL}/api/datasets/${id}?type=${type}`, {
        method: 'DELETE',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },
  },
};

export default apiClient;
