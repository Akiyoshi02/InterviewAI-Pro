/**
 * AI Interviewer Voice Configuration
 * Maps interviewer profiles to OS-specific voice names
 */

import { detectOS } from '../utils/osDetection';

/**
 * Get the voice configuration for an interviewer based on OS
 * @param {string} interviewerId - The interviewer ID
 * @returns {Object} - Voice configuration with voiceName and voiceCriteria
 */
export function getInterviewerVoiceConfig(interviewerId) {
  const os = detectOS();
  
  // Voice mappings by OS
  const voiceConfigs = {
    windows: {
      // Female voices (US English)
      'sarah': { 
        voiceName: 'Microsoft Zira', 
        voiceCriteria: { gender: 'female', lang: 'en' },
        alternativeVoices: [
          'Microsoft Hazel',      // UK English
          'Microsoft Aria',        // US English (if available)
          'Microsoft Eva',         // US English (if available)
          'Microsoft Linda',       // Canada English
          'Microsoft Jenny',       // US English (if available)
          'Microsoft Catherine',   // Australia English
          'Microsoft Susan',       // UK English
          'Microsoft Heera'        // India English
        ]
      },
      'elena': { 
        voiceName: 'Microsoft Hazel', 
        voiceCriteria: { gender: 'female', lang: 'en' },
        alternativeVoices: [
          'Microsoft Aria',        // US English (if available)
          'Microsoft Eva',         // US English (if available)
          'Microsoft Linda',       // Canada English
          'Microsoft Jenny',       // US English (if available)
          'Microsoft Zira',        // US English
          'Microsoft Catherine',   // Australia English
          'Microsoft Susan',       // UK English
          'Microsoft Heera'        // India English
        ]
      },
      // Male voices (US English)
      'marcus': { 
        voiceName: 'Microsoft David', 
        voiceCriteria: { gender: 'male', lang: 'en' },
        alternativeVoices: [
          'Microsoft Mark',        // US English
          'Microsoft Richard',     // Canada English
          'Microsoft Guy',         // US English (if available)
          'Microsoft Roger',       // US English (if available)
          'Microsoft George',      // UK English
          'Microsoft James',        // Australia English
          'Microsoft Ravi',         // India English
          'Microsoft Sean'          // Ireland English
        ]
      },
      'david': { 
        voiceName: 'Microsoft Mark', 
        voiceCriteria: { gender: 'male', lang: 'en' },
        alternativeVoices: [
          'Microsoft Richard',     // Canada English
          'Microsoft Guy',         // US English (if available)
          'Microsoft Roger',       // US English (if available)
          'Microsoft David',       // US English
          'Microsoft George',      // UK English
          'Microsoft James',        // Australia English
          'Microsoft Ravi',         // India English
          'Microsoft Sean'          // Ireland English
        ]
      }
    },
    macos: {
      // Female voices (US English)
      'sarah': { 
        voiceName: 'Samantha', 
        voiceCriteria: { gender: 'female', lang: 'en' },
        alternativeVoices: [
          'Victoria',              // US English
          'Karen',                 // Australia English
          'Tessa',                 // South Africa English
          'Moira',                 // Ireland English
          'Fiona',                 // Scotland English
          'Veena'                  // India English
        ]
      },
      'elena': { 
        voiceName: 'Victoria', 
        voiceCriteria: { gender: 'female', lang: 'en' },
        alternativeVoices: [
          'Samantha',              // US English
          'Karen',                 // Australia English
          'Tessa',                 // South Africa English
          'Moira',                 // Ireland English
          'Fiona',                 // Scotland English
          'Veena'                  // India English
        ]
      },
      // Male voices (US English)
      'marcus': { 
        voiceName: 'Alex', 
        voiceCriteria: { gender: 'male', lang: 'en' },
        alternativeVoices: [
          'Daniel',                // UK English
          'Tom',                   // US English
          'Fred',                  // US English
          'Rishi',                 // India English
          'Oliver'                 // UK English
        ]
      },
      'david': { 
        voiceName: 'Daniel', 
        voiceCriteria: { gender: 'male', lang: 'en' },
        alternativeVoices: [
          'Alex',                  // US English
          'Tom',                   // US English
          'Fred',                  // US English
          'Rishi',                 // India English
          'Oliver'                 // UK English
        ]
      }
    },
    // Default/fallback configuration (works for Linux, mobile, etc.)
    default: {
      'sarah': { 
        voiceName: null, 
        voiceCriteria: { gender: 'female', lang: 'en' },
        alternativeVoices: []
      },
      'elena': { 
        voiceName: null, 
        voiceCriteria: { gender: 'female', lang: 'en' },
        alternativeVoices: []
      },
      'marcus': { 
        voiceName: null, 
        voiceCriteria: { gender: 'male', lang: 'en' },
        alternativeVoices: []
      },
      'david': { 
        voiceName: null, 
        voiceCriteria: { gender: 'male', lang: 'en' },
        alternativeVoices: []
      }
    }
  };

  // Get OS-specific config or fallback to default
  const osConfig = voiceConfigs[os] || voiceConfigs.default;
  return osConfig[interviewerId] || voiceConfigs.default[interviewerId] || { 
    voiceName: null, 
    voiceCriteria: { gender: 'female', lang: 'en' },
    alternativeVoices: []
  };
}

/**
 * Get all available interviewers with their voice configurations
 * @param {Array} availableVoices - Array of available SpeechSynthesisVoice objects
 * @returns {Array} - Array of interviewer configurations with available voices
 */
export function getAvailableInterviewers(availableVoices = []) {
  const os = detectOS();
  const voiceNames = availableVoices.map(v => v.name);
  
  const baseInterviewers = [
    {
      id: 'sarah',
      name: 'Sarah Chen',
      title: 'Senior Technical Interviewer',
      avatar: "https://images.unsplash.com/photo-1646041805292-fd77781436f9",
      avatarAlt: 'Professional Asian woman with shoulder-length black hair wearing navy blazer',
      personality: 'Professional, thorough, and encouraging',
      specialties: ['Technical Skills', 'Problem Solving', 'System Design'],
      sampleQuestions: [
        "Can you walk me through your approach to solving complex technical problems?",
        "Tell me about a challenging project you've worked on recently."
      ]
    },
    {
      id: 'marcus',
      name: 'Marcus Johnson',
      title: 'Behavioral Interview Specialist',
      avatar: "https://images.unsplash.com/photo-1724128195747-dd25cba7860f",
      avatarAlt: 'Professional African American man with short hair wearing dark suit and tie',
      personality: 'Warm, insightful, and detail-oriented',
      specialties: ['Leadership', 'Communication', 'Team Dynamics'],
      sampleQuestions: [
        "Describe a time when you had to lead a team through a difficult situation.",
        "How do you handle conflicts within your team?"
      ]
    },
    {
      id: 'elena',
      name: 'Elena Rodriguez',
      title: 'Product & Strategy Expert',
      avatar: "https://images.unsplash.com/photo-1603562380012-2f58e2c8ad21",
      avatarAlt: 'Professional Hispanic woman with long brown hair wearing white blouse',
      personality: 'Strategic, analytical, and forward-thinking',
      specialties: ['Product Management', 'Strategy', 'Market Analysis'],
      sampleQuestions: [
        "How would you prioritize features for a new product launch?",
        "Walk me through your process for market research and validation."
      ]
    },
    {
      id: 'david',
      name: 'David Kim',
      title: 'Executive Interview Coach',
      avatar: "https://images.unsplash.com/photo-1735653194261-040d376e0658",
      avatarAlt: 'Professional Asian man with glasses wearing gray suit jacket',
      personality: 'Experienced, challenging, and insightful',
      specialties: ['Executive Presence', 'Strategic Thinking', 'Leadership'],
      sampleQuestions: [
        "What's your vision for leading organizational change?",
        "How do you make decisions when facing uncertainty?"
      ]
    }
  ];

  // Add voice configuration to each interviewer
  return baseInterviewers.map(interviewer => {
    const voiceConfig = getInterviewerVoiceConfig(interviewer.id);
    
    // Check if the preferred voice is available
    let actualVoiceName = null;
    if (voiceConfig.voiceName) {
      // Helper function to match voice names (case-insensitive, handles partial matches)
      const matchVoice = (voiceName, availableVoiceName) => {
        const v1 = voiceName.toLowerCase();
        const v2 = availableVoiceName.toLowerCase();
        // Exact match
        if (v1 === v2) return true;
        // One contains the other
        if (v1.includes(v2) || v2.includes(v1)) return true;
        // Match last word (e.g., "Zira" matches "Microsoft Zira Desktop")
        const lastWord1 = v1.split(' ').pop();
        const lastWord2 = v2.split(' ').pop();
        if (lastWord1 === lastWord2 && lastWord1.length > 2) return true;
        return false;
      };

      // Try to find exact match or partial match
      const foundVoice = availableVoices.find(v => matchVoice(voiceConfig.voiceName, v.name));
      
      if (foundVoice) {
        actualVoiceName = foundVoice.name;
      } else {
        // Try alternative voices
        for (const altVoice of voiceConfig.alternativeVoices || []) {
          const foundAlt = availableVoices.find(v => matchVoice(altVoice, v.name));
          if (foundAlt) {
            actualVoiceName = foundAlt.name;
            break;
          }
        }
      }
    }

    return {
      ...interviewer,
      voiceName: actualVoiceName || voiceConfig.voiceName,
      voiceCriteria: voiceConfig.voiceCriteria,
      alternativeVoices: voiceConfig.alternativeVoices,
      isVoiceAvailable: !!actualVoiceName || voiceConfig.voiceName === null // null means use criteria-based selection
    };
  });
}

