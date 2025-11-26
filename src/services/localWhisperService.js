/**
 * Local Whisper Service
 * 
 * Interfaces with the local faster-whisper Flask server for speech-to-text transcription.
 * This bypasses OpenAI API calls and runs Whisper inference on the local GPU.
 * 
 * @module localWhisperService
 */

const LOCAL_WHISPER_URL = import.meta.env.VITE_LOCAL_WHISPER_URL || 'http://localhost:5000';

/**
 * Check if the local Whisper server is running and ready
 * @returns {Promise<boolean>} - True if server is healthy
 */
export async function checkLocalWhisperHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${LOCAL_WHISPER_URL}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn('Health check failed:', response.status);
      return false;
    }
    
    const data = await response.json();
    console.log('✓ Whisper server healthy:', data);
    return data.status === 'healthy' || data.status === 'ok';
  } catch (error) {
    console.warn('Local Whisper server not available:', error.message);
    return false;
  }
}

/**
 * Get available models on the local Whisper server
 * @returns {Promise<Object>} - Model information
 */
export async function getLocalWhisperModels() {
  try {
    const response = await fetch(`${LOCAL_WHISPER_URL}/models`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch local Whisper models:', error);
    throw error;
  }
}

/**
 * Transcribe audio using the local Whisper server
 * @param {Blob} audioBlob - Audio data to transcribe (webm/wav/mp3)
 * @param {Object} options - Transcription options
 * @param {string} options.language - Language code (e.g., 'en', 'es') or 'auto'
 * @param {boolean} options.translateToEnglish - Translate to English if true
 * @returns {Promise<Object>} - Transcription result
 */
export async function transcribeWithLocalWhisper(audioBlob, options = {}) {
  const {
    language = 'en',
    translateToEnglish = false
  } = options;

  try {
    // Create FormData with audio file
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('language', language);
    formData.append('task', translateToEnglish ? 'translate' : 'transcribe');

    // Send to local server
    const response = await fetch(`${LOCAL_WHISPER_URL}/transcribe`, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type - browser sets it automatically with boundary
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
      source: 'local-whisper'
    };
  } catch (error) {
    console.error('Local Whisper transcription error:', error);
    throw error;
  }
}

/**
 * Transcribe audio using local Whisper (no fallback to OpenAI)
 * @param {Blob} audioBlob - Audio data to transcribe
 * @param {Object} options - Transcription options
 * @returns {Promise<Object>} - Transcription result with source indicator
 */
export async function transcribeWithFallback(audioBlob, options = {}) {
  console.log(`Attempting local Whisper transcription (${(audioBlob.size / 1024).toFixed(2)} KB audio)`);
  console.log(`Whisper server URL: ${LOCAL_WHISPER_URL}`);
  
  try {
    // Check if server is healthy
    console.log('Checking Whisper server health...');
    const isHealthy = await checkLocalWhisperHealth();
    
    if (!isHealthy) {
      throw new Error(`Local Whisper server at ${LOCAL_WHISPER_URL} is not responding. Make sure the server is running: python whisper_server.py`);
    }
    
    console.log('✓ Server healthy, transcribing audio...');
    const result = await transcribeWithLocalWhisper(audioBlob, options);
    console.log('✓ Transcription complete:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Local Whisper transcription failed:', error);
    throw new Error(
      `Local Whisper transcription failed: ${error.message}\n\n` +
      `Troubleshooting:\n` +
      `1. Ensure Whisper server is running: cd server && python whisper_server.py\n` +
      `2. Check server logs for errors\n` +
      `3. Verify server is accessible at: ${LOCAL_WHISPER_URL}/health`
    );
  }
}

/**
 * Get server statistics (for monitoring/debugging)
 * @returns {Promise<Object>} - Server stats
 */
export async function getLocalWhisperStats() {
  try {
    const [health, models] = await Promise.all([
      checkLocalWhisperHealth(),
      getLocalWhisperModels().catch(() => null)
    ]);
    
    return {
      available: health,
      url: LOCAL_WHISPER_URL,
      models: models,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      available: false,
      url: LOCAL_WHISPER_URL,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

export default {
  checkLocalWhisperHealth,
  getLocalWhisperModels,
  transcribeWithLocalWhisper,
  transcribeWithFallback,
  getLocalWhisperStats
};
