/**
 * Audio Recorder Service
 * Wraps MediaRecorder to capture microphone audio into a Blob (webm/opus)
 * Provides simple start/stop API and basic duration tracking.
 */

class AudioRecorderService {
  constructor() {
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this.isRecording = false;
    this.startTime = null;
    this.onStart = null;
    this.onStop = null;
    this.onError = null;
  }

  /**
   * Start microphone recording
   * @returns {Promise<boolean>} true if started
   */
  async start() {
    if (this.isRecording) return false;
    try {
      // Request mic
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.mediaStream, mimeType ? { mimeType } : undefined);
      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.onerror = (e) => {
        console.error('MediaRecorder error:', e.error);
        if (this.onError) this.onError(e.error);
      };

      this.mediaRecorder.onstart = () => {
        this.isRecording = true;
        this.startTime = Date.now();
        if (this.onStart) this.onStart();
      };

      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        if (this.onStop) this.onStop();
      };

      this.mediaRecorder.start(250); // collect small chunks
      return true;
    } catch (err) {
      console.error('Failed to start recording:', err);
      if (this.onError) this.onError(err);
      return false;
    }
  }

  /**
   * Stop recording and return a Blob of audio
   * @returns {Promise<Blob>} recorded audio blob
   */
  async stop() {
    if (!this.mediaRecorder || !this.isRecording) return null;

    const stopped = new Promise((resolve) => {
      this.mediaRecorder.addEventListener('stop', () => resolve(true), { once: true });
    });

    this.mediaRecorder.stop();
    await stopped;

    // Build blob
    const mimeType = this.getSupportedMimeType() || 'audio/webm';
    const blob = new Blob(this.chunks, { type: mimeType });

    // Cleanup
    this.chunks = [];
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    this.mediaRecorder = null;
    this.isRecording = false;
    this.startTime = null;

    return blob;
  }

  /**
   * Abort and cleanup without returning audio
   */
  abort() {
    try {
      if (this.mediaRecorder && this.isRecording) {
        this.mediaRecorder.stop();
      }
    } catch {}
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
    this.isRecording = false;
    this.startTime = null;
  }

  /**
   * Pick a supported mime type for MediaRecorder
   */
  getSupportedMimeType() {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg'
    ];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return null;
  }

  getDurationMs() {
    return this.startTime ? Date.now() - this.startTime : 0;
  }
}

const audioRecorderService = new AudioRecorderService();
export default audioRecorderService;
