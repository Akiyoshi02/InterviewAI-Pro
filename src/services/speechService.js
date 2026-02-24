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

  normalizeName(value = '') {
    return String(value).toLowerCase().replace(/[\s_]+/g, '-').trim();
  }

  getVoicesByLanguage(lang = 'en') {
    const voices = this.synth.getVoices();
    if (!lang) return voices;
    const normalized = String(lang).toLowerCase();
    return voices.filter((voice) => {
      const voiceLang = String(voice.lang || '').toLowerCase();
      return voiceLang === normalized || voiceLang.startsWith(`${normalized.split('-')[0]}-`);
    });
  }

  /**
   * Find a voice using loose matching criteria.
   * @param {{ gender?: string, lang?: string }} criteria
   * @returns {SpeechSynthesisVoice|null}
   */
  findVoice(criteria = {}) {
    const { gender, lang } = criteria || {};
    const voices = this.getVoicesByLanguage(lang || 'en');
    if (!voices.length) return null;

    const normalizedGender = String(gender || '').toLowerCase();
    if (!normalizedGender) {
      return voices[0];
    }

    const genderHints = {
      female: /(female|zira|samantha|victoria|karen|moira|tessa|zira)/i,
      male: /(male|david|alex|daniel)/i,
    };
    const matcher = genderHints[normalizedGender];
    if (!matcher) {
      return voices[0];
    }

    return voices.find((voice) => matcher.test(voice.name)) || voices[0];
  }

  /**
   * Get a suitable voice for the AI interviewer
   * Prioritizes: English, female/neutral voices
   */
  getPreferredVoice(lang = 'en') {
    const voices = this.getVoicesByLanguage(lang);
    if (!voices.length) return null;
    
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

  resolveVoice(optionVoice, optionCriteria = null, lang = 'en-US') {
    const voices = this.synth.getVoices();
    if (!voices.length) return null;

    if (optionVoice) {
      if (typeof optionVoice === 'object' && optionVoice.name) {
        const matchedByName = voices.find((voice) => voice.name === optionVoice.name);
        if (matchedByName) return matchedByName;
      }

      if (typeof optionVoice === 'string') {
        const normalizedRequested = this.normalizeName(optionVoice);
        const matchedByName = voices.find((voice) => voice.name === optionVoice);
        if (matchedByName) return matchedByName;

        const matchedByNormalizedName = voices.find(
          (voice) => this.normalizeName(voice.name) === normalizedRequested,
        );
        if (matchedByNormalizedName) return matchedByNormalizedName;

        const matchedByPartialNormalizedName = voices.find((voice) => {
          const normalizedVoiceName = this.normalizeName(voice.name);
          return normalizedVoiceName.includes(normalizedRequested)
            || normalizedRequested.includes(normalizedVoiceName);
        });
        if (matchedByPartialNormalizedName) return matchedByPartialNormalizedName;
      }
    }

    if (optionCriteria) {
      const matchedByCriteria = this.findVoice(optionCriteria);
      if (matchedByCriteria) return matchedByCriteria;
    }

    return this.getPreferredVoice(lang);
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
      const language = options.lang || 'en-US';
      const voice = this.resolveVoice(options.voice, options.voiceCriteria, language);
      if (voice) {
        utterance.voice = voice;
      }

      // Configure speech parameters
      utterance.rate = options.rate || 1.0;      // Speed (0.1 to 10)
      utterance.pitch = options.pitch || 1.0;    // Pitch (0 to 2)
      utterance.volume = options.volume || 1.0;  // Volume (0 to 1)
      utterance.lang = language;

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
