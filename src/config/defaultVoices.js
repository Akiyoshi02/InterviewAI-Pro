/**
 * Default Voice Configuration
 * Only includes voices that are pre-installed by default on Windows and macOS
 * Differentiates between mobile and desktop variants
 */

import { detectOS, detectDeviceType } from '../utils/osDetection';

/**
 * Get all available default voices based on OS and device type
 * @param {Array} availableVoices - Array of available SpeechSynthesisVoice objects
 * @returns {Array} - Array of voice options with name, gender, and availability
 */
export function getDefaultVoices(availableVoices = []) {
  const os = detectOS();
  const deviceType = detectDeviceType();
  
  // Default voice definitions
  const defaultVoiceDefinitions = {
    windows: {
      desktop: [
        { name: 'Microsoft Zira', gender: 'female', baseName: 'Zira' },
        { name: 'Microsoft David', gender: 'male', baseName: 'David' }
      ],
      mobile: [
        { name: 'Microsoft Zira Mobile', gender: 'female', baseName: 'Zira' },
        { name: 'Microsoft David Mobile', gender: 'male', baseName: 'David' }
      ]
    },
    macos: {
      desktop: [
        { name: 'Samantha', gender: 'female' },
        { name: 'Alex', gender: 'male' },
        { name: 'Victoria', gender: 'female' },
        { name: 'Daniel', gender: 'male' },
        { name: 'Karen', gender: 'female' }, // Australian
        { name: 'Moira', gender: 'female' }, // Irish
        { name: 'Tessa', gender: 'female' }  // South African
      ],
      mobile: [
        { name: 'Samantha', gender: 'female' },
        { name: 'Alex', gender: 'male' },
        { name: 'Victoria', gender: 'female' },
        { name: 'Daniel', gender: 'male' },
        { name: 'Karen', gender: 'female' },
        { name: 'Moira', gender: 'female' },
        { name: 'Tessa', gender: 'female' }
      ]
    }
  };

  // Get OS-specific voices
  const osVoices = defaultVoiceDefinitions[os]?.[deviceType] || defaultVoiceDefinitions[os]?.desktop || [];
  
  // Helper function to match voice names
  const matchVoice = (voiceName, availableVoiceName) => {
    const v1 = voiceName.toLowerCase();
    const v2 = availableVoiceName.toLowerCase();
    // Exact match
    if (v1 === v2) return true;
    // One contains the other
    if (v1.includes(v2) || v2.includes(v1)) return true;
    // Match base name (e.g., "Zira" matches "Microsoft Zira Desktop")
    const baseName = voiceName.split(' ').pop().toLowerCase();
    if (v2.includes(baseName)) return true;
    return false;
  };

  // Filter to only include voices that are actually available
  return osVoices
    .map(voiceDef => {
      // Try to find the voice in available voices
      const foundVoice = availableVoices.find(v => matchVoice(voiceDef.name, v.name));
      
      if (foundVoice) {
        return {
          id: foundVoice.name.toLowerCase().replace(/\s+/g, '-'),
          name: foundVoice.name,
          displayName: voiceDef.name.replace('Microsoft ', '').replace(' Mobile', ''),
          gender: voiceDef.gender,
          voice: foundVoice,
          isAvailable: true
        };
      }
      
      // Voice not found, but include it anyway with isAvailable: false
      return {
        id: voiceDef.name.toLowerCase().replace(/\s+/g, '-'),
        name: voiceDef.name,
        displayName: voiceDef.name.replace('Microsoft ', '').replace(' Mobile', ''),
        gender: voiceDef.gender,
        voice: null,
        isAvailable: false
      };
    })
    .filter(v => v.isAvailable); // Only return available voices
}

/**
 * Get default voice configuration for a selected voice
 * @param {string} voiceId - The voice ID
 * @param {Array} availableVoices - Array of available SpeechSynthesisVoice objects
 * @returns {Object} - Voice configuration with voiceName and voiceCriteria
 */
export function getVoiceConfig(voiceId, availableVoices = []) {
  const voices = getDefaultVoices(availableVoices);
  const selectedVoice = voices.find(v => v.id === voiceId);
  
  if (selectedVoice && selectedVoice.voice) {
    return {
      voiceName: selectedVoice.voice.name,
      voiceCriteria: { gender: selectedVoice.gender, lang: 'en' }
    };
  }
  
  // Fallback to gender-based selection
  const voice = voices.find(v => v.id === voiceId);
  if (voice) {
    return {
      voiceName: null,
      voiceCriteria: { gender: voice.gender, lang: 'en' }
    };
  }
  
  // Final fallback
  return {
    voiceName: null,
    voiceCriteria: { gender: 'female', lang: 'en' }
  };
}

