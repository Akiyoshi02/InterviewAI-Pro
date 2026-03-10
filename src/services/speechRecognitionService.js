/**
 * Speech Recognition Service
 * Handles candidate voice input using Web Speech API
 * Supports continuous recognition with pause detection
 */

class SpeechRecognitionService {
  constructor() {
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      if (import.meta.env.DEV) {
        console.info('Speech Recognition not supported in this browser');
      }
      this.supported = false;
      return;
    }

    this.supported = true;
    this.recognition = new SpeechRecognition();
    this.isListening = false;
    this.isPaused = false;
    this.finalTranscript = '';
    this.interimTranscript = '';
    this.silenceTimer = null;
    this.silenceThreshold = 2000; // 2 seconds of silence
    
    // Configure recognition
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    // Event handlers (will be set by caller)
    this.onResult = null;
    this.onEnd = null;
    this.onError = null;
    this.onStart = null;
    this.onSilenceDetected = null;

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup recognition event listeners
   */
  setupEventListeners() {
    if (!this.recognition) return;

    // Handle recognition results
    this.recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          final += transcript + ' ';
        } else {
          interim += transcript;
        }
      }

      // Update transcripts
      if (final) {
        this.finalTranscript += final;
        this.resetSilenceTimer(); // Reset silence timer on new speech
      }
      
      this.interimTranscript = interim;

      // Callback with results
      if (this.onResult) {
        this.onResult({
          final: this.finalTranscript.trim(),
          interim: this.interimTranscript.trim(),
          isFinal: final.length > 0
        });
      }
    };

    // Handle recognition end
    this.recognition.onend = () => {
      this.isListening = false;
      
      // Clear silence timer
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      if (this.onEnd) {
        this.onEnd(this.finalTranscript.trim());
      }
    };

    // Handle errors
    this.recognition.onerror = (event) => {
      console.error('Recognition error:', event.error);

      if (this.onError) {
        this.onError(event.error);
      }
    };

    // Handle start
    this.recognition.onstart = () => {
      this.isListening = true;
      
      if (this.onStart) {
        this.onStart();
      }

      // Start silence detection
      this.resetSilenceTimer();
    };
  }

  /**
   * Start listening for speech
   */
  start() {
    if (!this.supported) {
      console.error('Speech recognition not supported');
      return false;
    }

    if (this.isListening) {
      return false;
    }

    try {
      // Reset transcripts
      this.finalTranscript = '';
      this.interimTranscript = '';
      
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('Failed to start recognition:', error);
      return false;
    }
  }

  /**
   * Stop listening
   */
  stop() {
    if (!this.isListening) {
      return;
    }

    try {
      this.recognition.stop();
      
      // Clear silence timer
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    } catch (error) {
      console.error('Failed to stop recognition:', error);
    }
  }

  /**
   * Abort recognition immediately
   */
  abort() {
    if (!this.isListening) {
      return;
    }

    try {
      this.recognition.abort();
      this.isListening = false;
      
      // Clear silence timer
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    } catch (error) {
      console.error('Failed to abort recognition:', error);
    }
  }

  /**
   * Reset silence detection timer
   */
  resetSilenceTimer() {
    // Clear existing timer
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }

    // Start new timer
    this.silenceTimer = setTimeout(() => {
      if (this.onSilenceDetected && this.finalTranscript.trim().length > 0) {
        this.onSilenceDetected(this.finalTranscript.trim());
      }
    }, this.silenceThreshold);
  }

  /**
   * Set silence threshold (in milliseconds)
   */
  setSilenceThreshold(ms) {
    this.silenceThreshold = ms;
  }

  /**
   * Get current transcript
   */
  getTranscript() {
    return {
      final: this.finalTranscript.trim(),
      interim: this.interimTranscript.trim(),
      full: (this.finalTranscript + ' ' + this.interimTranscript).trim()
    };
  }

  /**
   * Check if currently listening
   */
  getIsListening() {
    return this.isListening;
  }

  /**
   * Check if speech recognition is supported
   */
  static isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Get supported languages (placeholder - browser dependent)
   */
  getSupportedLanguages() {
    return ['en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN'];
  }

  /**
   * Set recognition language
   */
  setLanguage(lang) {
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }
}

// Export singleton instance
const speechRecognitionService = new SpeechRecognitionService();
export default speechRecognitionService;
