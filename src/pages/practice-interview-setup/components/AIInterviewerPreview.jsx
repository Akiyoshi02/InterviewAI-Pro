import React, { useState, useEffect, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import speechService from '../../../services/speechService';
import { useToast } from '../../../components/ui/Toast';
import { getDefaultVoices, getVoiceConfig } from '../../../config/defaultVoices';
import { detectOS, detectDeviceType } from '../../../utils/osDetection';
import { generateRandomName, detectNameGender } from '../../../utils/nameGenerator';

// AI Interviewer Personality Options
// These personalities define how the AI interviewer communicates and interacts during the interview
const PERSONALITY_OPTIONS = [
  {
    id: 'professional-encouraging',
    label: 'Professional, thorough, and encouraging',
    description: 'Balanced and supportive approach',
    colorGradient: 'from-blue-500 to-cyan-500',
    icon: 'Shield'
  },
  {
    id: 'warm-insightful',
    label: 'Warm, insightful, and detail-oriented',
    description: 'Friendly and empathetic style',
    colorGradient: 'from-orange-500 to-amber-500',
    icon: 'Heart'
  },
  {
    id: 'strategic-analytical',
    label: 'Strategic, analytical, and forward-thinking',
    description: 'Thoughtful and methodical approach',
    colorGradient: 'from-purple-500 to-pink-500',
    icon: 'Target'
  },
  {
    id: 'experienced-challenging',
    label: 'Experienced, challenging, and insightful',
    description: 'Rigorous and thought-provoking style',
    colorGradient: 'from-slate-700 to-slate-900',
    icon: 'Award'
  },
  {
    id: 'data-driven-methodical',
    label: 'Data-driven, methodical, and curious',
    description: 'Evidence-based and systematic approach',
    colorGradient: 'from-emerald-500 to-teal-500',
    icon: 'BarChart3'
  },
  {
    id: 'fast-paced-innovative',
    label: 'Fast-paced, innovative, and results-oriented',
    description: 'Dynamic and action-focused style',
    colorGradient: 'from-rose-500 to-orange-500',
    icon: 'Zap'
  },
  {
    id: 'user-focused-empathetic',
    label: 'User-focused, empathetic, and creative',
    description: 'Human-centered and understanding approach',
    colorGradient: 'from-indigo-500 to-violet-500',
    icon: 'Users'
  },
  {
    id: 'collaborative-team-oriented',
    label: 'Collaborative, team-oriented, and inclusive',
    description: 'Emphasizes teamwork and diverse perspectives',
    colorGradient: 'from-cyan-500 to-blue-500',
    icon: 'UserPlus'
  },
  {
    id: 'direct-transparent',
    label: 'Direct, transparent, and candid',
    description: 'Straightforward and honest communication style',
    colorGradient: 'from-gray-600 to-gray-800',
    icon: 'MessageSquare'
  },
  {
    id: 'growth-oriented-developmental',
    label: 'Growth-oriented, developmental, and supportive',
    description: 'Focuses on learning and continuous improvement',
    colorGradient: 'from-green-500 to-emerald-500',
    icon: 'TrendingUp'
  },
  {
    id: 'conversational-authentic',
    label: 'Conversational, authentic, and relatable',
    description: 'Natural and genuine interaction style',
    colorGradient: 'from-pink-500 to-rose-500',
    icon: 'MessageCircle'
  },
  {
    id: 'outcome-focused-metrics',
    label: 'Outcome-focused, metrics-driven, and results-oriented',
    description: 'Emphasizes measurable impact and performance',
    colorGradient: 'from-violet-500 to-purple-500',
    icon: 'Activity'
  }
];

const AIInterviewerPreview = ({ 
  selectedPersonality,
  onPersonalityChange,
  selectedVoice,
  onVoiceChange,
  interviewerName,
  onInterviewerNameChange,
  className = '' 
}) => {
  const [previewMode, setPreviewMode] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [os, setOS] = useState(null);
  const [deviceType, setDeviceType] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [actualVoiceName, setActualVoiceName] = useState(null);
  const { error: showErrorToast, warning: showWarningToast } = useToast();
  const previousVoiceGenderRef = useRef(null);

  // Load available default voices
  useEffect(() => {
    const detectedOS = detectOS();
    const detectedDeviceType = detectDeviceType();
    setOS(detectedOS);
    setDeviceType(detectedDeviceType);
    
    const loadVoices = () => {
      const voices = speechService.getVoices();
      if (voices.length > 0) {
        const defaultVoices = getDefaultVoices(voices);
        setAvailableVoices(defaultVoices);
        
        // Set default voice if none selected
        if (!selectedVoice && defaultVoices.length > 0) {
          onVoiceChange(defaultVoices[0].id);
        }
      } else {
        setTimeout(loadVoices, 100);
      }
    };

    loadVoices();
    
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoice, onVoiceChange]);

  // Set default personality if none selected
  useEffect(() => {
    if (!selectedPersonality && PERSONALITY_OPTIONS.length > 0) {
      onPersonalityChange(PERSONALITY_OPTIONS[0].id);
    }
  }, [selectedPersonality, onPersonalityChange]);

  const selectedVoiceObj = availableVoices.find(v => v.id === selectedVoice);

  // Set actual voice name when voice is selected
  useEffect(() => {
    if (selectedVoiceObj) {
      // Use the full voice name from the voice object
      if (selectedVoiceObj.voice && selectedVoiceObj.voice.name) {
        setActualVoiceName(selectedVoiceObj.voice.name);
      } else if (selectedVoiceObj.name) {
        setActualVoiceName(selectedVoiceObj.name);
      } else {
        setActualVoiceName(selectedVoiceObj.displayName || 'Auto-selected');
      }
    }
  }, [selectedVoiceObj]);

  // Generate or update interviewer name based on voice gender
  useEffect(() => {
    if (selectedVoiceObj && !interviewerName) {
      // Generate initial name based on voice gender
      const gender = selectedVoiceObj.gender;
      const generatedName = generateRandomName(gender);
      onInterviewerNameChange(generatedName);
    }
  }, [selectedVoiceObj, interviewerName, onInterviewerNameChange]);

  // Regenerate name when voice gender changes
  useEffect(() => {
    if (selectedVoiceObj && interviewerName) {
      const voiceGender = selectedVoiceObj.gender;
      const previousGender = previousVoiceGenderRef.current;
      
      // Check if we need to update the name
      // Either: voice gender changed, or this is the first time we're checking (previousGender is null)
      if (!previousGender || previousGender !== voiceGender) {
        const nameGender = detectNameGender(interviewerName);
        
        // If the name gender doesn't match the voice gender, automatically regenerate
        if (nameGender && nameGender !== voiceGender) {
          const newName = generateRandomName(voiceGender);
          onInterviewerNameChange(newName);
        }
      }
      
      // Update the ref to track current gender
      previousVoiceGenderRef.current = voiceGender;
    } else if (selectedVoiceObj) {
      // Update ref even if no name yet
      previousVoiceGenderRef.current = selectedVoiceObj.gender;
    }
  }, [selectedVoiceObj?.gender, selectedVoiceObj, interviewerName, onInterviewerNameChange]);

  const handleRandomizeName = () => {
    // Stop preview if it's currently playing
    if (isSpeaking || previewMode) {
      speechService.cancel();
      setIsSpeaking(false);
      setPreviewMode(false);
    }
    
    if (selectedVoiceObj) {
      const gender = selectedVoiceObj.gender;
      const newName = generateRandomName(gender);
      onInterviewerNameChange(newName);
    }
  };

  // Cleanup: cancel speech when component unmounts
  useEffect(() => {
    return () => {
      if (isSpeaking) {
        speechService.cancel();
      }
    };
  }, [isSpeaking]);

  // Cancel speech when voice changes (not when interviewer style changes)
  useEffect(() => {
    if (isSpeaking) {
      speechService.cancel();
      setIsSpeaking(false);
      setPreviewMode(false);
    }
    // actualVoiceName is now set when voice is selected, so we don't clear it here
  }, [selectedVoice]);

  const handlePreviewInteraction = async () => {
    if (isSpeaking || previewMode) {
      speechService.cancel();
      setIsSpeaking(false);
      setPreviewMode(false);
      return;
    }

    if (!speechService.constructor.isSupported()) {
      showWarningToast('Speech synthesis is not supported in your browser.');
      return;
    }

    setPreviewMode(true);
    setIsSpeaking(true);

    const displayName = interviewerName || 'Your Interviewer';
    const previewMessage = `Hello! I'm ${displayName}. I'm excited to help you practice your interview skills today. Let's start with a simple question to get warmed up.`;

    try {
      // Get voice configuration for selected voice
      const voices = speechService.getVoices();
      const voiceConfig = getVoiceConfig(selectedVoice, voices);
      
      let voice = null;
      if (voiceConfig.voiceName) {
        voice = voiceConfig.voiceName;
      } else if (voiceConfig.voiceCriteria) {
        voice = speechService.findVoice(voiceConfig.voiceCriteria);
      }

      // Get actual voice object (but don't update actualVoiceName here - it's already set)
      let actualVoice = null;
      if (typeof voice === 'string') {
        actualVoice = voices.find(v => v.name === voice || v.name.includes(voice));
        if (!actualVoice && voiceConfig.voiceCriteria) {
          actualVoice = speechService.findVoice(voiceConfig.voiceCriteria);
        }
      } else if (voice) {
        actualVoice = voice;
      }
      
      // actualVoiceName is already set when voice is selected, so we don't need to update it here

      await speechService.speak(previewMessage, {
        rate: 0.95,
        pitch: 1.0,
        volume: 1.0,
        voice: voice,
        voiceCriteria: voiceConfig.voiceCriteria,
        onStart: () => {
          setIsSpeaking(true);
        },
        onEnd: () => {
          setIsSpeaking(false);
          setPreviewMode(false);
        },
        onError: (error) => {
          console.error('Preview speech error:', error);
          setIsSpeaking(false);
          setPreviewMode(false);
          showErrorToast('Failed to play preview. Please try again.');
        }
      });
    } catch (error) {
      console.error('Preview error:', error);
      setIsSpeaking(false);
      setPreviewMode(false);
      showErrorToast('Failed to play preview. Please try again.');
    }
  };

  // Prepare voice options for Select component
  const voiceOptions = availableVoices.map(voice => ({
    value: voice.id,
    label: `${voice.displayName} (${voice.gender === 'female' ? 'Female' : 'Male'})`,
    description: voice.name
  }));

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Icon name="Bot" size={20} className="text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">AI Interviewer</h3>
      </div>

      {/* Interviewer Name */}
      {selectedVoiceObj && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Interviewer Name
          </label>
          <div className="flex items-center gap-3">
            <div className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50 text-gray-900 dark:text-slate-100">
              <span className="font-medium">{interviewerName || 'Generating name...'}</span>
            </div>
            <Button
              variant="outline"
              size="default"
              iconName="RefreshCw"
              iconPosition="left"
              onClick={handleRandomizeName}
              disabled={!selectedVoiceObj}
              className="rounded-full whitespace-nowrap"
            >
              Randomize
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-2">
            Name will be tailored to {selectedVoiceObj.gender === 'female' ? 'female' : 'male'} voice preferences
          </p>
        </div>
      )}

      {/* Voice/Actor Selection */}
      <div className="mb-6">
        <Select
          label="Voice Actor"
          description="Select the voice that will speak during the interview"
          options={voiceOptions}
          value={selectedVoice}
          onChange={onVoiceChange}
          placeholder="Select a voice..."
          searchable={voiceOptions.length > 5}
        />
        {deviceType && (
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-2">
            Device: {deviceType === 'mobile' ? 'Mobile' : 'Desktop'} | 
            Platform: {os === 'windows' ? 'Windows' : os === 'macos' ? 'macOS' : os || 'Unknown'}
          </p>
        )}
      </div>

      {/* Voice Preview Section (TTS only) */}
      {selectedVoiceObj && (
        <div className="relative overflow-hidden rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur mb-6">
          <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0%_0%,rgba(147,51,234,0.1),transparent_45%)]" />
          <div className="relative z-10">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Icon name="Volume2" size={20} className="text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Voice Preview</h3>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-1">
                  {interviewerName || 'Your Interviewer'}
                </p>
                <p className="text-xs text-gray-600 dark:text-slate-400">
                  Voice: {actualVoiceName || selectedVoiceObj.displayName}
                </p>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                iconName={isSpeaking ? "Square" : "Play"}
                iconPosition="left"
                onClick={handlePreviewInteraction}
                disabled={!selectedVoice}
                className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                {isSpeaking ? 'Stop' : previewMode ? 'Playing...' : 'Preview Voice'}
              </Button>
            </div>

            {/* Voice Preview Message */}
            {(previewMode || isSpeaking) && (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/60 bg-emerald-50/50 dark:bg-emerald-500/10 p-4 backdrop-blur">
                <div className="flex items-center space-x-3">
                  {isSpeaking && (
                    <div className="w-3 h-3 bg-emerald-600 dark:bg-emerald-400 rounded-full animate-pulse"></div>
                  )}
                  <p className="text-sm text-gray-900 dark:text-slate-100 font-medium">
                    {`"Hello! I'm ${interviewerName || 'Your Interviewer'}. I'm excited to help you practice your interview skills today.
                    Let's start with a simple question to get warmed up."
                    `}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Interviewer Personality Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
          AI Interviewer Personality
        </label>
        <p className="text-xs text-gray-500 dark:text-slate-500 mb-3">
          Select the personality traits that define how the AI interviewer communicates and interacts with you during the interview.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PERSONALITY_OPTIONS.map((personality) => (
            <button
              key={personality.id}
              onClick={() => onPersonalityChange(personality.id)}
              className={`p-5 rounded-2xl border-2 transition-all duration-200 text-left hover:-translate-y-1 hover:shadow-lg ${
                selectedPersonality === personality.id
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 shadow-md shadow-blue-500/20'
                  : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-500 bg-white dark:bg-slate-800'
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="relative">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${personality.colorGradient} flex items-center justify-center shadow-md`}>
                    <Icon name={personality.icon} size={24} className="text-white" />
                  </div>
                  {selectedPersonality === personality.id && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
                      <Icon name="Check" size={12} color="white" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-2 font-semibold">
                    {personality.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-500">
                    {personality.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AIInterviewerPreview;
