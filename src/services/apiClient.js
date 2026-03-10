/**
 * Centralized API client for backend communication
 * Handles authentication, error handling, and API calls
 */
import { authHelpers } from '../config/firebase.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_BASE = API_URL.replace(/\/$/, '');

const isAbsoluteHttpUrl = (value) => /^https?:\/\//i.test(String(value || ''));

const normalizeUploadsPath = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/uploads/')) return trimmed;
  if (trimmed.startsWith('uploads/')) return `/${trimmed}`;

  const normalized = trimmed.replaceAll('\\', '/');
  if (normalized.includes('..')) return null;

  const knownPrefixes = [
    'profile-photos/',
    'resumes/',
    'company-logos/',
    'company-covers/',
    'company-verifications/',
    'job-advert-images/',
    'job-advert-videos/',
    'interviews/',
  ];
  const lower = normalized.toLowerCase();
  const hasKnownPrefix = knownPrefixes.some((prefix) => lower.startsWith(prefix));
  if (!hasKnownPrefix) return null;
  return `/uploads/${normalized}`;
};

const toApiAbsoluteUrl = (pathValue) => `${API_BASE}${pathValue.startsWith('/') ? pathValue : `/${pathValue}`}`;

/**
 * Get authentication token from Firebase
 */
async function getAuthToken() {
  try {
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

function getMeetingTokenFromLocation() {
  if (typeof window === 'undefined') return null;
  try {
    const searchParams = new URLSearchParams(window.location.search || '');
    const token = searchParams.get('token');
    return token && token.trim() ? token.trim() : null;
  } catch {
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

  const meetingToken = getMeetingTokenFromLocation();
  if (meetingToken) {
    headers['X-Meeting-Token'] = meetingToken;
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
        'NO_ORGANIZATION',
        'TOO_EARLY',
        'EXPIRED',
        'INVALID_TOKEN',
        'MISSING_TOKEN',
        'NO_TOKEN',
        'MEETING_LINK_REQUIRED',
        'NOT_SCHEDULED',
        'INVALID_SCHEDULE',
        'FORBIDDEN',
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
    
    const error = new Error(data.error || data.message || text || `API Error: ${response.statusText}`);
    error.status = response.status;
    error.code = data.code || null;
    error.details = data.details || null;
    error.error = data.error || null;
    throw error;
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

      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers,
        body,
      });
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
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'GET',
        headers,
      });
      return handleResponse(response);
    },
    async updateMe(payload) {
      const headers = await getHeaders();
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
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

    async updateCompanyCover(file) {
      const formData = new FormData();
      formData.append('companyCover', file);

      const token = await getAuthToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/auth/me/company-cover`, {
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

    async parseResume(file, options = {}) {
      const formData = new FormData();
      formData.append('resumeFile', file);
      if (options?.accountType) {
        formData.append('accountType', options.accountType);
      }

      const token = await getAuthToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_URL}/api/auth/me/parse-resume`, {
        method: 'POST',
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
      
      try {
        const response = await fetch(`${API_URL}/api/auth/delete-unregistered-auth-user`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ userId }),
        });
        return await handleResponse(response);
      } catch (error) {
        console.error('deleteUnregisteredAuthUser API error:', error);
        throw error;
      }
    },
  },

  uploads: {
    async getDownloadUrl(pathValue, { expiresInSeconds = 300 } = {}) {
      if (!pathValue) return null;
      if (isAbsoluteHttpUrl(pathValue)) return pathValue;

      const normalizedPath = normalizeUploadsPath(pathValue);
      if (!normalizedPath) {
        const fallback = String(pathValue || '').trim();
        return fallback ? toApiAbsoluteUrl(fallback) : null;
      }

      try {
        const headers = await getHeaders();
        const params = new URLSearchParams({
          path: normalizedPath,
          expiresInSeconds: String(expiresInSeconds),
        });
        const response = await fetch(`${API_BASE}/api/object-storage/signed-url?${params.toString()}`, {
          method: 'GET',
          headers,
        });
        const data = await handleResponse(response);
        if (data?.downloadUrl) {
          return data.downloadUrl;
        }
      } catch (error) {
        console.warn('Failed to fetch signed upload URL, using direct fallback:', error?.message || error);
      }

      return toApiAbsoluteUrl(normalizedPath);
    },

    async moderateProfilePhoto(file) {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/api/uploads/moderate/profile-photo`, {
        method: 'POST',
        body: formData,
      });

      return handleResponse(response);
    },

    async moderateCompanyLogo(file) {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/api/uploads/moderate/company-logo`, {
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

      const response = await fetch(`${API_BASE}/api/uploads/moderate/resume`, {
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

      const response = await fetch(`${API_BASE}/api/uploads/moderate/company-proof`, {
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

    async validateMeetingAccess(interviewId, token) {
      const response = await fetch(
        `${API_URL}/api/interviews/${interviewId}/validate-meeting-access?token=${encodeURIComponent(token)}`,
        { method: 'GET', headers: await getHeaders() },
      );
      return handleResponse(response);
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

    async schedule(interviewId, payload) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/schedule`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async reschedule(interviewId, payload) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/reschedule`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async updateReviewRequests(interviewId, payload) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/review-requests`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async sendReviewReminder(interviewId, reviewerId) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/review-requests/${reviewerId}/remind`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async updateStageOutcome(interviewId, payload) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/stage-outcome`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async createNextStage(interviewId) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/next-stage`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async requestReschedule(interviewId, payload) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/reschedule-request`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async rejectRescheduleRequest(interviewId, requestId, payload = {}) {
      const response = await fetch(
        `${API_URL}/api/interviews/${interviewId}/reschedule-request/${requestId}/reject`,
        {
          method: 'POST',
          headers: await getHeaders(),
          body: JSON.stringify(payload),
        },
      );
      return handleResponse(response);
    },

    async contactCompany(interviewId, payload) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/contact-company`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async cancel(interviewId, payload = {}) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/cancel`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async uploadRecording(interviewId, recordingFile) {
      const formData = new FormData();
      formData.append('recording', recordingFile);
      const token = await getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const meetingToken = getMeetingTokenFromLocation();
      if (meetingToken) {
        headers['X-Meeting-Token'] = meetingToken;
      }

      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/recording`, {
        method: 'POST',
        headers,
        body: formData,
      });
      return handleResponse(response);
    },

    async getRecordingUrl(interviewId) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/recording-url`, {
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

    async runEvaluation(interviewId) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/run-evaluation`, {
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

    async getScoreLeaderboard() {
      const response = await fetch(`${API_URL}/api/interviews/leaderboards/scores`, {
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

    async markQuestionAsked(interviewId, questionId, options = {}) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/question/asked`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ questionId }),
        signal: options?.signal,
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

    async saveQuestionNotes(interviewId, questionId, prepNotes) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/question/${questionId}/notes`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify({ prepNotes: prepNotes || '' }),
      });
      return handleResponse(response);
    },

    async getShareToken(interviewId) {
      const response = await fetch(`${API_URL}/api/interviews/${interviewId}/share-token`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getSharedResults(token) {
      const response = await fetch(`${API_URL}/api/interviews/shared/${token}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return handleResponse(response);
    },

    async getCandidateFullAnalytics() {
      const response = await fetch(`${API_URL}/api/analytics/candidate/full`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getLongitudinalData() {
      const response = await fetch(`${API_URL}/api/analytics/longitudinal`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },
  },

  /**
   * Personal Answer Library (saved answers) - candidate only
   */
  savedAnswers: {
    async create({ questionText, answer, interviewId, questionId, notes, tags, rating }) {
      const response = await fetch(`${API_URL}/api/saved-answers`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({
          questionText: questionText || '',
          answer: answer || '',
          interviewId: interviewId || undefined,
          questionId: questionId || undefined,
          notes: notes || undefined,
          tags: Array.isArray(tags) ? tags : undefined,
          rating: rating != null ? rating : undefined,
        }),
      });
      return handleResponse(response);
    },

    async list({ limit = 100, tag } = {}) {
      const params = new URLSearchParams();
      if (limit != null) params.set('limit', String(limit));
      if (tag) params.set('tag', tag);
      const qs = params.toString();
      const response = await fetch(`${API_URL}/api/saved-answers${qs ? `?${qs}` : ''}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async update(id, { notes, tags, rating }) {
      const response = await fetch(`${API_URL}/api/saved-answers/${id}`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify({
          notes: notes !== undefined ? notes : undefined,
          tags: tags !== undefined ? tags : undefined,
          rating: rating !== undefined ? rating : undefined,
        }),
      });
      return handleResponse(response);
    },

    async delete(id) {
      const response = await fetch(`${API_URL}/api/saved-answers/${id}`, {
        method: 'DELETE',
        headers: await getHeaders(),
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
   * Candidate Companies Directory APIs
   */
  companies: {
    async list({ search = '', industry = '', size, page } = {}) {
      const params = new URLSearchParams();
      if (String(search || '').trim()) params.set('search', String(search).trim());
      if (String(industry || '').trim()) params.set('industry', String(industry).trim());
      if (size != null) params.set('size', String(size));
      if (page != null) params.set('page', String(page));

      const query = params.toString();
      const response = await fetch(`${API_URL}/api/companies${query ? `?${query}` : ''}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getBySlug(slug) {
      const response = await fetch(`${API_URL}/api/companies/${encodeURIComponent(slug)}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getMyProfile() {
      const response = await fetch(`${API_URL}/api/companies/me/profile`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async updateMyProfile(payload) {
      const response = await fetch(`${API_URL}/api/companies/me/profile`, {
        method: 'PUT',
        headers: await getHeaders(),
        body: JSON.stringify(payload || {}),
      });
      return handleResponse(response);
    },
  },

  /**
   * Billing APIs (company/organization)
   */
  billing: {
    async getPlans() {
      const response = await fetch(`${API_URL}/api/billing/plans`, {
        method: 'GET',
        headers: await getHeaders(false),
      });
      return handleResponse(response);
    },

    async getSubscription() {
      const response = await fetch(`${API_URL}/api/billing/subscription`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getUsage() {
      const response = await fetch(`${API_URL}/api/billing/usage`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getBillingHistory(limit = 50) {
      const response = await fetch(`${API_URL}/api/billing/history?limit=${limit}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async updateSubscription(planId) {
      const response = await fetch(`${API_URL}/api/billing/subscription`, {
        method: 'PUT',
        headers: await getHeaders(),
        body: JSON.stringify({ planId }),
      });
      return handleResponse(response);
    },

    async cancelSubscription(cancelAtPeriodEnd = true) {
      const response = await fetch(`${API_URL}/api/billing/subscription`, {
        method: 'DELETE',
        headers: await getHeaders(),
        body: JSON.stringify({ cancelAtPeriodEnd }),
      });
      return handleResponse(response);
    },

    async createCheckoutSession(planId) {
      const response = await fetch(`${API_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ planId }),
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

    async uploadAdvertImage(jobId, file, advertImageAlt = '') {
      const formData = new FormData();
      formData.append('jobAdvertImage', file);
      if (advertImageAlt) {
        formData.append('advertImageAlt', advertImageAlt);
      }

      const token = await getAuthToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/jobs/${jobId}/advert-image`, {
        method: 'PATCH',
        headers,
        body: formData,
      });
      return handleResponse(response);
    },

    async uploadAdvertVideo(jobId, file) {
      const formData = new FormData();
      formData.append('jobAdvertVideo', file);

      const token = await getAuthToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/jobs/${jobId}/advert-video`, {
        method: 'PATCH',
        headers,
        body: formData,
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

    async remove(jobId, options = null) {
      const hasOptions = Boolean(options && Object.keys(options).length > 0);
      const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
        method: 'DELETE',
        headers: await getHeaders(),
        ...(hasOptions ? { body: JSON.stringify(options) } : {}),
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

    async getStructuredInterviewGovernance(limit = 500) {
      const response = await fetch(`${API_URL}/api/admin/structured-interviews/governance?limit=${limit}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async previewStructuredInterviewPlan(payload = {}) {
      const response = await fetch(`${API_URL}/api/admin/structured-interviews/preview`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async getQuestionCatalogSources(includeDisabled = false) {
      const params = new URLSearchParams();
      if (includeDisabled) {
        params.append('includeDisabled', 'true');
      }
      const suffix = params.toString() ? `?${params}` : '';
      const response = await fetch(`${API_URL}/api/admin/question-catalog/sources${suffix}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async importQuestionCatalogSource(payload = {}) {
      const response = await fetch(`${API_URL}/api/admin/question-catalog/import`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async getQuestionCatalogImports(limit = 50) {
      const response = await fetch(`${API_URL}/api/admin/question-catalog/imports?limit=${limit}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getQuestionCatalogQuestions(filters = {}) {
      const params = new URLSearchParams();
      if (filters.reviewStatus) params.append('reviewStatus', filters.reviewStatus);
      if (filters.source) params.append('source', filters.source);
      if (filters.type) params.append('type', filters.type);
      params.append('limit', String(filters.limit || 300));
      const response = await fetch(`${API_URL}/api/admin/question-catalog/questions?${params}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async reviewQuestionCatalogQuestion(id, payload = {}) {
      const response = await fetch(`${API_URL}/api/admin/question-catalog/questions/${id}/review`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async refreshQuestionCatalogCache() {
      const response = await fetch(`${API_URL}/api/admin/question-catalog/cache/refresh`, {
        method: 'POST',
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

    async getAIHealth() {
      const response = await fetch(`${API_URL}/api/ai/health`, {
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

    async getAuditLogs(limit = 100, offset = 0, cursor = null) {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (cursor) {
        params.set('cursor', String(cursor));
      } else {
        params.set('offset', String(offset));
      }
      const response = await fetch(`${API_URL}/api/admin/audit-logs?${params.toString()}`, {
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

    async listUsers(options = {}) {
      const params = new URLSearchParams();
      if (options.accountType) params.set('accountType', options.accountType);
      if (options.status) params.set('status', options.status);
      if (options.q) params.set('q', options.q);
      if (options.limit) params.set('limit', String(options.limit));
      if (options.offset) params.set('offset', String(options.offset));

      const query = params.toString();
      const response = await fetch(`${API_URL}/api/admin/users${query ? `?${query}` : ''}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async updateUserStatus(id, payload) {
      const response = await fetch(`${API_URL}/api/admin/users/${id}/status`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify(payload || {}),
      });
      return handleResponse(response);
    },

    async promoteToSystemAdmin(id) {
      const response = await fetch(`${API_URL}/api/admin/users/${id}/promote-system-admin`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getBillingOverview() {
      const response = await fetch(`${API_URL}/api/admin/billing-overview`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getNewsletterStats() {
      const response = await fetch(`${API_URL}/api/admin/newsletter-stats`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getDataRetentionSummary() {
      const response = await fetch(`${API_URL}/api/admin/data-retention/summary`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async runDataRetentionCleanup(payload = {}) {
      const response = await fetch(`${API_URL}/api/admin/data-retention/run`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async getClassificationMetrics(limit = 500) {
      const response = await fetch(`${API_URL}/api/admin/classification-metrics?limit=${limit}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getMediaPipeCalibration() {
      const response = await fetch(`${API_URL}/api/admin/mediapipe-calibration`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getFineTuneStatus() {
      const response = await fetch(`${API_URL}/api/admin/fine-tune/status`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async triggerFineTune() {
      const response = await fetch(`${API_URL}/api/admin/fine-tune`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async evaluateFineTunedModel() {
      const response = await fetch(`${API_URL}/api/admin/fine-tune/evaluate`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async exportTrainingData() {
      const response = await fetch(`${API_URL}/api/admin/fine-tune/export`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(err.error || 'Export failed');
      }
      return response.blob();
    },

    async importTrainedGGUF(ggufPath) {
      const response = await fetch(`${API_URL}/api/admin/fine-tune/import-gguf`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ ggufPath }),
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

    async getMyApplications(options = null) {
      const params = new URLSearchParams();
      if (options && typeof options === 'object') {
        if (options.status) params.append('status', options.status);
        if (options.limit) params.append('limit', String(options.limit));
        if (options.cursor) params.append('cursor', String(options.cursor));
      }
      const queryString = params.toString();
      const response = await fetch(`${API_URL}/api/candidates/applications${queryString ? `?${queryString}` : ''}`, {
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

    async getJobApplications(jobId, options = null) {
      const params = new URLSearchParams();
      if (options && typeof options === 'object') {
        if (options.status) params.append('status', options.status);
        if (options.limit) params.append('limit', String(options.limit));
        if (options.cursor) params.append('cursor', String(options.cursor));
      }
      const queryString = params.toString();
      const response = await fetch(`${API_URL}/api/jobs/${jobId}/applications${queryString ? `?${queryString}` : ''}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async getOrganizationApplications(statusOrOptions = null, limit = 200) {
      const options = statusOrOptions && typeof statusOrOptions === 'object'
        ? statusOrOptions
        : { status: statusOrOptions, limit };
      const params = new URLSearchParams();
      if (options.status) params.append('status', options.status);
      if (options.limit) params.append('limit', String(options.limit));
      if (options.cursor) params.append('cursor', String(options.cursor));
      const response = await fetch(`${API_URL}/api/organizations/applications?${params}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async updateStatus(id, statusOrPayload, reviewedBy = null) {
      const payload =
        statusOrPayload && typeof statusOrPayload === 'object'
          ? { ...statusOrPayload }
          : { status: statusOrPayload, reviewedBy };
      const response = await fetch(`${API_URL}/api/applications/${id}`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async upsertOffer(id, payload) {
      const response = await fetch(`${API_URL}/api/applications/${id}/offer`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async resendOffer(id) {
      const response = await fetch(`${API_URL}/api/applications/${id}/offer/resend`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async acceptOffer(id) {
      const response = await fetch(`${API_URL}/api/applications/${id}/offer/accept`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async declineOffer(id, payload = {}) {
      const response = await fetch(`${API_URL}/api/applications/${id}/offer/decline`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async updateOnboarding(id, payload = {}) {
      const response = await fetch(`${API_URL}/api/applications/${id}/onboarding`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async respondToOnboardingTask(id, taskId, payload = {}) {
      const response = await fetch(`${API_URL}/api/applications/${id}/onboarding/tasks/${taskId}/respond`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async reviewOnboardingTask(id, taskId, payload = {}) {
      const response = await fetch(`${API_URL}/api/applications/${id}/onboarding/tasks/${taskId}`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },

    async bulkUpdateStatus(applicationIds = [], statusOrPayload) {
      const payload = statusOrPayload && typeof statusOrPayload === 'object'
        ? { ...statusOrPayload }
        : { status: statusOrPayload };
      payload.applicationIds = Array.isArray(applicationIds) ? applicationIds : [];

      const response = await fetch(`${API_URL}/api/applications/bulk/status`, {
        method: 'PATCH',
        headers: await getHeaders(),
        body: JSON.stringify(payload),
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

    async getStructuredCatalog() {
      const response = await fetch(`${API_URL}/api/templates/structured/catalog`, {
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

  /**
   * Notification APIs
   */
  notifications: {
    async list({ unreadOnly = false, limit = 30 } = {}) {
      const params = new URLSearchParams({ limit });
      if (unreadOnly) params.set('unreadOnly', 'true');
      const response = await fetch(`${API_URL}/api/notifications?${params}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async markRead(id) {
      const response = await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async markAllRead() {
      const response = await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async delete(id) {
      const response = await fetch(`${API_URL}/api/notifications/${id}`, {
        method: 'DELETE',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },
  },

  referrals: {
    async getMyReferral() {
      const response = await fetch(`${API_URL}/api/referrals/me`, { headers: await getHeaders() });
      return handleResponse(response);
    },
    async getLeaderboard() {
      const response = await fetch(`${API_URL}/api/referrals/leaderboard`, { headers: await getHeaders() });
      return handleResponse(response);
    },
  },

  webhooks: {
    async list() {
      const response = await fetch(`${API_URL}/api/webhooks`, { headers: await getHeaders() });
      return handleResponse(response);
    },
    async create(payload) {
      const response = await fetch(`${API_URL}/api/webhooks`, {
        method: 'POST', headers: await getHeaders(), body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },
    async update(id, payload) {
      const response = await fetch(`${API_URL}/api/webhooks/${id}`, {
        method: 'PUT', headers: await getHeaders(), body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },
    async remove(id) {
      const response = await fetch(`${API_URL}/api/webhooks/${id}`, {
        method: 'DELETE', headers: await getHeaders(),
      });
      return handleResponse(response);
    },
    async test(id) {
      const response = await fetch(`${API_URL}/api/webhooks/${id}/test`, {
        method: 'POST', headers: await getHeaders(),
      });
      return handleResponse(response);
    },
    async deliveries(id) {
      const response = await fetch(`${API_URL}/api/webhooks/${id}/deliveries`, { headers: await getHeaders() });
      return handleResponse(response);
    },
  },

  twofa: {
    async getStatus() {
      const response = await fetch(`${API_URL}/api/2fa/status`, { headers: await getHeaders() });
      return handleResponse(response);
    },
    async totpSetup() {
      const response = await fetch(`${API_URL}/api/2fa/totp/setup`, { method: 'POST', headers: await getHeaders() });
      return handleResponse(response);
    },
    async totpVerify(token) {
      const response = await fetch(`${API_URL}/api/2fa/totp/verify`, {
        method: 'POST', headers: await getHeaders(), body: JSON.stringify({ token }),
      });
      return handleResponse(response);
    },
    async totpDisable(token) {
      const response = await fetch(`${API_URL}/api/2fa/totp/disable`, {
        method: 'POST', headers: await getHeaders(), body: JSON.stringify({ token }),
      });
      return handleResponse(response);
    },
    async emailSend() {
      const response = await fetch(`${API_URL}/api/2fa/email/send`, { method: 'POST', headers: await getHeaders() });
      return handleResponse(response);
    },
    async emailVerify(otp) {
      const response = await fetch(`${API_URL}/api/2fa/email/verify`, {
        method: 'POST', headers: await getHeaders(), body: JSON.stringify({ otp }),
      });
      return handleResponse(response);
    },
    async useBackupCode(code) {
      const response = await fetch(`${API_URL}/api/2fa/backup/use`, {
        method: 'POST', headers: await getHeaders(), body: JSON.stringify({ code }),
      });
      return handleResponse(response);
    },
  },

  gdpr: {
    async exportData() {
      const response = await fetch(`${API_URL}/api/gdpr/export`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async requestDeletion() {
      const response = await fetch(`${API_URL}/api/gdpr/delete`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async cancelDeletion() {
      const response = await fetch(`${API_URL}/api/gdpr/delete`, {
        method: 'DELETE',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    async saveConsent(prefs) {
      const response = await fetch(`${API_URL}/api/gdpr/consent`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(prefs),
      });
      return handleResponse(response);
    },

    async getConsent() {
      const response = await fetch(`${API_URL}/api/gdpr/consent`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },
  },
};

export default apiClient;
