/**
 * Speech Service - Handles Text-to-Speech using Web Speech API
 * Provides browser-based TTS for the AI interviewer's voice
 */

class SpeechService {
  constructor() {
    this.synth = window.speechSynthesis;
    this.currentUtterance = null;
    this.isPaused = false;
    this.availableVoices = [];
    
    // Load voices when available
    this.loadVoices();
    
    // Some browsers load voices asynchronously
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  /**
   * Load available voices from the browser
   */
  loadVoices() {
    this.availableVoices = this.synth.getVoices();
    console.log('Available voices:', this.availableVoices.length);
  }

  /**
   * Get a suitable voice for the AI interviewer
   * Prioritizes: English, female/neutral voices
   */
  getPreferredVoice() {
    const voices = this.synth.getVoices();
    
    // Try to find a good English voice
    const preferredVoices = [
      // Google voices (high quality)
      voices.find(v => v.name === 'Google UK English Female'),
      voices.find(v => v.name === 'Google US English'),
      // Microsoft voices
      voices.find(v => v.name.includes('Microsoft Zira')),
      voices.find(v => v.name.includes('Microsoft David')),
      // macOS voices
      voices.find(v => v.name === 'Samantha'),
      voices.find(v => v.name === 'Alex'),
      // Any English voice
      voices.find(v => v.lang.startsWith('en-')),
      // Fallback to first available
      voices[0]
    ];

    return preferredVoices.find(v => v !== undefined);
  }

  /**
   * Speak text using Web Speech API
   * @param {string} text - The text to speak
   * @param {Object} options - Speech options
   * @returns {Promise} - Resolves when speech is complete
   */
  speak(text, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      // Cancel any ongoing speech
      this.cancel();

      // Create utterance
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set voice
      const voice = this.getPreferredVoice();
      if (voice) {
        utterance.voice = voice;
      }

      // Configure speech parameters
      utterance.rate = options.rate || 1.0;      // Speed (0.1 to 10)
      utterance.pitch = options.pitch || 1.0;    // Pitch (0 to 2)
      utterance.volume = options.volume || 1.0;  // Volume (0 to 1)
      utterance.lang = options.lang || 'en-US';

      // Event handlers
      utterance.onstart = () => {
        console.log('Speech started:', text.substring(0, 50));
        if (options.onStart) options.onStart();
      };

      utterance.onend = () => {
        console.log('Speech ended');
        this.currentUtterance = null;
        if (options.onEnd) options.onEnd();
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('Speech error:', event.error);
        this.currentUtterance = null;
        if (options.onError) options.onError(event.error);
        reject(new Error(`Speech error: ${event.error}`));
      };

      utterance.onpause = () => {
        this.isPaused = true;
        if (options.onPause) options.onPause();
      };

      utterance.onresume = () => {
        this.isPaused = false;
        if (options.onResume) options.onResume();
      };

      // Store and speak
      this.currentUtterance = utterance;
      this.synth.speak(utterance);
    });
  }

  /**
   * Pause current speech
   */
  pause() {
    if (this.synth.speaking && !this.isPaused) {
      this.synth.pause();
      this.isPaused = true;
    }
  }

  /**
   * Resume paused speech
   */
  resume() {
    if (this.synth.speaking && this.isPaused) {
      this.synth.resume();
      this.isPaused = false;
    }
  }

  /**
   * Cancel/stop current speech
   */
  cancel() {
    if (this.synth.speaking || this.synth.pending) {
      this.synth.cancel();
      this.currentUtterance = null;
      this.isPaused = false;
    }
  }

  /**
   * Check if currently speaking
   */
  isSpeaking() {
    return this.synth.speaking;
  }

  /**
   * Get all available voices
   */
  getVoices() {
    return this.synth.getVoices();
  }

  /**
   * Check if speech synthesis is supported
   */
  static isSupported() {
    return 'speechSynthesis' in window;
  }
}

// Export singleton instance
const speechService = new SpeechService();
export default speechService;
