# Practice Interview Setup - Data Flow Analysis

## Summary
This document analyzes what data is collected during the practice interview setup process and how it flows through the system.

**Related Documents:**
- See [practice-interview-fixes-summary.md](./practice-interview-fixes-summary.md) for summary of fixes applied
- See [interview-style-removal-summary.md](./interview-style-removal-summary.md) for details on Interview Style removal

## Data Collected in Setup Forms

### Step 1: Job Details
- ✅ `jobRole` - Selected job role
- ✅ `experienceLevel` - Selected experience level  
- ✅ `industry` - Selected industry

### Step 2: Interview Setup
- ✅ `interviewTypes` - Array of selected interview types
- ✅ `sessionDuration` - Selected duration (default: 30)
- ✅ `advancedSettings`:
  - ✅ `skillFocus` - Array of skill areas to focus on
  - ✅ `language` - Language preference (default: 'en')
  - ✅ `realTimeFeedback` - Boolean flag
  - ✅ `followUpQuestions` - Boolean flag
  - ✅ `recordSession` - Boolean flag
  - ✅ `practiceMode` - Boolean flag
  - ✅ `difficulty` - Difficulty level (easy, medium, hard)

**Note:** Interview Style was removed as it was redundant with Personality (see Step 3).

### Step 3: AI Interviewer
- ✅ `personality` - Selected AI interviewer personality ID
- ✅ `voice` - Selected voice/actor ID
- ✅ `interviewerName` - Generated or custom interviewer name

### Step 4: Preparation
- No data collected (just a readiness checklist)

---

## What Gets Sent to API (when Start Interview is pressed)

**Location:** `src/pages/practice-interview-setup/index.jsx:135-143`

Currently sent to API:
```javascript
{
  mode: 'PRACTICE',
  jobRole: formData.jobRole,                    // ✅ SENT
  experienceLevel: formData.experienceLevel,    // ✅ SENT
  industry: formData.industry,                  // ✅ SENT
  interviewTypes: formData.interviewTypes,      // ✅ SENT
  skillFocus: formData.advancedSettings?.skillFocus,  // ✅ SENT
  duration: formData.sessionDuration,           // ✅ SENT
  config: {                                     // ✅ SENT (added in fixes)
    personality: formData.personality,
    voice: formData.voice,
    interviewerName: formData.interviewerName,
    advancedSettings: formData.advancedSettings
  }
}
```

**Note:** Additional configuration is now included in the `config` field, making all settings available to the backend.

---

## What Gets Saved to localStorage

**Location:** `src/pages/practice-interview-setup/index.jsx:151-154`

✅ **Full `formData` object is saved:**
```javascript
localStorage.setItem('interviewConfig', JSON.stringify({
  ...formData,  // Includes ALL fields
  interviewId: result.interview.id,
}));
```

This means all collected data is available in the interview session via localStorage.

---

## What Gets Used in Live Interview Session

**Location:** `src/pages/live-interview-session/index.jsx:125-161`

The session loads config using a multi-source fallback mechanism:

```javascript
// Priority order:
// 1. localStorage (if available)
// 2. Backend database (if localStorage missing and interviewId available)
// 3. Default values (if both unavailable)

const configStr = localStorage.getItem('interviewConfig');
let config = configStr ? JSON.parse(configStr) : null;

// Fallback to backend if localStorage missing
if (!config && interviewId) {
  const response = await apiClient.interviews.getById(interviewId);
  config = buildConfigFromInterview(response.interview);
}

// Final fallback to defaults
if (!config) {
  config = { /* defaults */ };
}

await initializeInterview(config);
```

**Improvement:** Config is now loaded from multiple sources, ensuring availability even after browser refresh or localStorage clearance.

### Used by useAIInterviewer Hook

**Location:** `src/hooks/useAIInterviewer.js:159-250`

✅ **USED:**
- `interviewConfig.voice` - Used to configure TTS voice (lines 195-214)
- `interviewConfig.personality` - Used in AI prompts (via personalityMapper)
- `interviewConfig.interviewerName` - Used in AI prompts and displayed in UI
- `interviewConfig.advancedSettings.difficulty` - Used in question generation prompts
- `interviewConfig.advancedSettings.followUpQuestions` - Enforced in answer processing
- `interviewConfig.advancedSettings.language` - ✅ Used in transcription (Whisper) and browser STT
- All config passed to `createAIInterviewer()` (lines 217-220)

✅ **USED:**
- `advancedSettings.realTimeFeedback` - ✅ Feature now conditionally displayed based on flag
- `advancedSettings.practiceMode` - ✅ Pause/resume and retry functionality implemented (re-speaks question)
- `advancedSettings.recordSession` - ✅ Recording state managed based on flag

**Config Merging:**
- Backend config merged with localStorage config when both exist (backend takes precedence)
- Ensures most up-to-date configuration is used

### Used by Backend LLM Service

**Location:** `server/src/services/llm.service.js:93-132`

✅ **USED in question generation:**
- `jobRole`
- `experienceLevel`
- `industry`
- `interviewTypes`
- `skillFocus`
- `totalQuestions` (derived from duration)
- `personality` - ✅ Now used to influence question style and tone
- `difficulty` - ✅ Now used to control question complexity (easy/medium/hard)
- `interviewerName` - ✅ Used in question generation prompts

### Used by Frontend AI Interviewer

**Location:** `src/services/aiInterviewer.js:21-30`

✅ **USED:**
- `jobRole`
- `company` (default: 'Tech Company')
- `experienceLevel`
- `industry`
- `interviewTypes`
- `interviewDuration`
- `totalQuestions`
- `personality` - ✅ Used in all system prompts (via personalityMapper)
- `interviewerName` - ✅ Used in system prompts and displayed in UI
- `advancedSettings.difficulty` - ✅ Used in question generation instructions
- `advancedSettings.followUpQuestions` - ✅ Enforced in answer processing logic

---

## Issues & Recommendations

### Issue 1: Missing Data in API Payload (RESOLVED)
**Problem:** Many collected fields are not sent to the backend API, so they cannot be stored in the database or used by backend services.

**Resolution:**
- Updated `server/src/controllers/interview.controller.js` to extract `config` from request body
- Updated `server/src/services/firebaseData.service.js` to store `config` field in interview record
- All configuration (personality, voice, interviewerName, advancedSettings) is now persisted in database

**Status:** ✅ **FIXED** - Config object is now stored in backend interview record.

### Issue 2: Personality Not Used in Prompts (RESOLVED)
**Problem:** User selects a personality but it's not incorporated into the AI interviewer's behavior.

**Resolution:**
- Created personalityMapper.js to map personality IDs to descriptions
- Updated all AI interviewer prompts to include personality descriptions
- Personality now influences communication style throughout the interview

**Status:** ✅ **FIXED** - Personality is now used in all AI prompts.

### Issue 3: Interview Style Removed (RESOLVED)
**Problem:** Interview Style was redundant with Personality - both controlled the same thing.

**Resolution:**
- Interview Style has been removed from Advanced Settings
- Personality now controls all communication style and tone
- Eliminated redundancy and potential conflicts

**Status:** ✅ **FIXED** - Interview Style removed, using Personality only.

### Issue 4: Difficulty Setting Not Used (RESOLVED)
**Problem:** User selects difficulty level but questions are generated with LLM-determined difficulty.

**Resolution:**
- Difficulty is now used in frontend AI interviewer prompts
- Difficulty affects question complexity during the interview
- Updated backend LLM service (`server/src/services/llm.service.js`) to use difficulty when generating questions
- Backend question generation now respects selected difficulty level (easy/medium/hard)
- Personality descriptions added to backend LLM service to influence question style

**Status:** ✅ **FIXED** - Difficulty is used in both frontend and backend question generation.

### Issue 5: Advanced Settings Flags Not Enforced (RESOLVED)
**Problem:** Flags like `followUpQuestions`, `realTimeFeedback`, `practiceMode` exist but aren't used to control behavior.

**Resolution:**
- `followUpQuestions` - ✅ Now enforced in answer processing logic
- `realTimeFeedback` - ✅ Feature conditionally displayed based on flag (RealTimeFeedbackPanel only shows when enabled)
- `practiceMode` - ✅ Pause/resume functionality implemented, retry button added to SessionControlPanel
- `recordSession` - ✅ Recording state initialized from flag and properly managed throughout session

**Status:** ✅ **FIXED** - All advanced settings flags are now properly enforced.

### Issue 6: Interviewer Name Not Used (RESOLVED)
**Problem:** Generated/custom interviewer name is saved but not displayed or used in prompts.

**Resolution:**
- Interviewer name is now used in all AI prompts
- Name is displayed in the interview session UI (AI Interviewer Panel)

**Status:** ✅ **FIXED** - Interviewer name is used in prompts and displayed in UI.

---

## Fixes Applied

### ✅ Completed Fixes

1. **API payload updated** - Added `config` field with all additional configuration
2. **Backend storage** - Config object now stored in interview record (`server/src/services/firebaseData.service.js`)
3. **Personality integrated** - Now used in all frontend and backend AI prompts
4. **Interview Style removed** - Eliminated redundancy with Personality
5. **Interviewer name** - Used in prompts and displayed in UI
6. **Difficulty** - Now used in both frontend and backend question generation
7. **Follow-up questions** - Flag now enforced in answer processing
8. **Backend question generation** - Uses personality and difficulty when initially generating questions
9. **Real-time feedback** - Feature conditionally displayed based on flag
10. **Practice mode** - Pause/resume and retry functionality implemented
11. **Session recording** - Recording state managed based on flag
12. **URL parameter handling** - Support for both `interviewId` and `id` URL parameters
13. **Backend config loading** - Config loads from database when localStorage is missing
14. **Language setting** - Language preference now used in transcription and TTS
15. **Config merging** - Backend config properly merged with localStorage config
16. **skillFocus in backend** - skillFocus now passed to backend LLM service

### ✅ All Issues Resolved

All identified issues have been resolved. The system now fully utilizes all collected configuration data and handles edge cases properly.

## Current State Summary

**✅ All collected data is now:**
- Sent to API (in `config` field)
- Stored in backend database (interview record)
- Saved to localStorage (for session access)
- **Loaded from backend when localStorage missing** - Fallback mechanism ensures config availability
- Used in frontend AI prompts (personality, name, difficulty, follow-up flag)
- Used in backend question generation (personality, difficulty, interviewerName, skillFocus)
- Displayed in UI (interviewer name)
- All advanced settings flags properly enforced:
  - Real-time feedback panel conditionally displayed
  - Practice mode pause/resume/retry functional (includes re-speaking question)
  - Session recording state managed
  - Language preference used in speech recognition and transcription

**✅ Edge cases handled:**
- URL parameter flexibility (supports both `interviewId` and `id`)
- Config loading from multiple sources (localStorage → backend → defaults)
- Config merging when multiple sources exist (backend takes precedence)
- Error handling for missing config scenarios

