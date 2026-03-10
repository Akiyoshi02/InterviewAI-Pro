/**
 * Local Whisper Service
 *
 * The browser no longer talks to the optional local faster-whisper process
 * directly. Availability and transcription both flow through backend AI
 * endpoints so local services stay behind the app's API boundary.
 */

const HEALTH_CACHE_WINDOW_MS = 300_000;
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');

let lastHealthCheckAt = 0;
let lastHealthResult = false;
let loggedUnavailableOnce = false;

const isAutomationEnvironment = () =>
  typeof navigator !== 'undefined' && navigator.webdriver === true;

const buildApiUrl = (path) => {
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`;

  if (API_BASE_URL) {
    return `${API_BASE_URL}${normalizedPath}`;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, '')}${normalizedPath}`;
  }

  return null;
};

const getMeetingTokenFromLocation = () => {
  if (typeof window === 'undefined') return null;
  try {
    const searchParams = new URLSearchParams(window.location.search || '');
    const token = searchParams.get('token');
    return token && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
};

const getProxyHeaders = () => {
  const headers = {};
  const meetingToken = getMeetingTokenFromLocation();
  if (meetingToken) {
    headers['X-Meeting-Token'] = meetingToken;
  }
  return headers;
};

const getAudioExtension = (mimeType = '') => {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('webm')) return 'webm';
  if (normalized.includes('ogg')) return 'ogg';
  if (normalized.includes('m4a')) return 'm4a';
  if (normalized.includes('mp4')) return 'mp4';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  return 'webm';
};

/**
 * Check whether local Whisper is reachable through the backend AI health
 * endpoint. This remains intentionally quiet because the local service is
 * optional and should not pollute runtime logs.
 *
 * @returns {Promise<boolean>}
 */
export async function checkLocalWhisperHealth({ silent = true, force = false } = {}) {
  if (isAutomationEnvironment()) {
    return false;
  }

  const now = Date.now();
  if (!force && lastHealthCheckAt && now - lastHealthCheckAt < HEALTH_CACHE_WINDOW_MS) {
    return lastHealthResult;
  }

  const aiHealthUrl = buildApiUrl('/api/ai/health');
  if (!aiHealthUrl) {
    lastHealthCheckAt = now;
    lastHealthResult = false;
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(aiHealthUrl, {
      method: 'GET',
      headers: getProxyHeaders(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (!silent && import.meta.env?.DEV && !loggedUnavailableOnce) {
        console.warn('Unable to verify Whisper availability via backend AI health.', response.status);
        loggedUnavailableOnce = true;
      }
      lastHealthCheckAt = now;
      lastHealthResult = false;
      return false;
    }

    const data = await response.json();
    lastHealthCheckAt = now;
    lastHealthResult = Boolean(data?.success && data?.whisperConfigured && data?.whisperReachable);

    if (lastHealthResult) {
      loggedUnavailableOnce = false;
    }

    return lastHealthResult;
  } catch (error) {
    if (!silent && !loggedUnavailableOnce) {
      console.warn('Whisper availability check failed through backend AI health:', error.message);
      loggedUnavailableOnce = true;
    }

    lastHealthCheckAt = now;
    lastHealthResult = false;
    return false;
  }
}

/**
 * Get available models from the backend Whisper proxy.
 *
 * @returns {Promise<Object>}
 */
export async function getLocalWhisperModels() {
  const modelsUrl = buildApiUrl('/api/ai/whisper/models');
  if (!modelsUrl) {
    throw new Error('Backend AI API base URL is not available.');
  }

  const response = await fetch(modelsUrl, {
    method: 'GET',
    headers: getProxyHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server returned ${response.status}`);
  }

  return response.json();
}

/**
 * Transcribe audio using the backend Whisper proxy.
 *
 * @param {Blob} audioBlob
 * @param {Object} options
 * @returns {Promise<Object>}
 */
export async function transcribeWithLocalWhisper(audioBlob, options = {}) {
  const transcribeUrl = buildApiUrl('/api/ai/whisper/transcribe');
  if (!transcribeUrl) {
    throw new Error('Backend AI API base URL is not available.');
  }

  const {
    language = 'en',
    translateToEnglish = false,
  } = options;

  const formData = new FormData();
  const extension = getAudioExtension(audioBlob?.type || '');
  formData.append('audio', audioBlob, `recording.${extension}`);
  formData.append('language', language);
  formData.append('task', translateToEnglish ? 'translate' : 'transcribe');

  const response = await fetch(transcribeUrl, {
    method: 'POST',
    headers: getProxyHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server returned ${response.status}`);
  }

  const result = await response.json();

  return {
    text: result.text,
    language: result.language,
    confidence: result.confidence || null,
    segments: result.segments || [],
    duration: result.duration || null,
    source: 'local-whisper',
  };
}

/**
 * Transcribe audio using backend-routed Whisper.
 *
 * @param {Blob} audioBlob
 * @param {Object} options
 * @returns {Promise<Object>}
 */
export async function transcribeWithFallback(audioBlob, options = {}) {
  try {
    const isHealthy = await checkLocalWhisperHealth({ silent: false, force: true });

    if (!isHealthy) {
      throw new Error(
        'Whisper transcription is currently unavailable through the backend proxy. If you are using the local Whisper server, start it with: cd server && python whisper_server.py',
      );
    }

    return await transcribeWithLocalWhisper(audioBlob, options);
  } catch (error) {
    throw new Error(
      `Whisper transcription failed: ${error.message}\n\n` +
      'Troubleshooting:\n' +
      '1. Ensure the backend API is running\n' +
      '2. If you use local Whisper, run: cd server && python whisper_server.py\n' +
      '3. Check /api/ai/health for Whisper readiness\n',
    );
  }
}

/**
 * Get server statistics for monitoring/debugging.
 *
 * @returns {Promise<Object>}
 */
export async function getLocalWhisperStats() {
  try {
    const [health, models] = await Promise.all([
      checkLocalWhisperHealth(),
      getLocalWhisperModels().catch(() => null),
    ]);

    return {
      available: health,
      url: buildApiUrl('/api/ai/whisper/transcribe'),
      models,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      available: false,
      url: buildApiUrl('/api/ai/whisper/transcribe'),
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

export default {
  checkLocalWhisperHealth,
  getLocalWhisperModels,
  transcribeWithLocalWhisper,
  transcribeWithFallback,
  getLocalWhisperStats,
};
