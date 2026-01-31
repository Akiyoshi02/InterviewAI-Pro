# Supervisor Tasks Implementation - January 2026

## Quick Navigation

| Resource | Location | Purpose |
|----------|----------|---------|
| **Research Tools Page** | `/research-tools` | Video recording, analysis, external dataset access |
| **Training Data Manager** | System Admin → Training Data tab | View/export auto-collected data |
| **Data Collection Guide** | `docs/RESEARCH_DATA_COLLECTION_GUIDE.md` | Step-by-step external data collection |

---

## Overview

This document describes the implementation of the two tasks from the supervisor's January 2026 progress report comments:

1. **Collect the dataset to train the LLM for interview conversation**
2. **Create a data library for MediaPipe face-mesh and posture key values to analyze correct posture**

---

## Task 1: LLM Interview Dataset Collection

### What Was Implemented

A complete system for collecting, storing, and exporting interview conversation data for LLM fine-tuning.

### Files Created

| File | Purpose |
|------|---------|
| `src/services/interviewDatasetService.js` | Frontend service for collecting interview Q&A pairs |
| `server/src/controllers/dataset.controller.js` | Backend API controller for dataset management |
| `server/src/routes/dataset.routes.js` | API routes for dataset operations |
| `src/pages/system-admin-dashboard/components/TrainingDataManager.jsx` | Admin UI for managing datasets |

### Features

1. **Data Collection**
   - Captures every question-answer pair during interviews
   - Records metadata: job role, experience level, industry, question type
   - Stores evaluation scores for quality filtering
   - Tracks conversation flow (introduction → questions → closing)

2. **Data Storage**
   - Local storage for immediate access
   - Firebase Firestore for permanent storage
   - Automatic quality scoring

3. **Export Formats**
   - **JSONL** format for LLM fine-tuning (OpenAI, Hugging Face compatible)
   - **JSON** format for analysis

### Data Structure for Training

```json
{
  "messages": [
    {"role": "system", "content": "You are a professional interviewer..."},
    {"role": "assistant", "content": "Tell me about yourself..."},
    {"role": "user", "content": "I'm a software engineer with 5 years..."}
  ],
  "metadata": {
    "jobRole": "Software Engineer",
    "experienceLevel": "Mid-level",
    "industry": "Technology"
  }
}
```

### How to Use

1. **Automatic Collection**: Data is automatically collected during practice interviews
2. **Export Data**: Access Admin Dashboard → Training Data Manager → Export
3. **Filter by Quality**: Set minimum quality score when exporting

---

## Task 2: MediaPipe Face-Mesh and Posture Data Library

### What Was Implemented

A comprehensive reference data library with ideal posture and facial landmark values, plus detection hooks that compare real-time data against these references.

### Files Created

| File | Purpose |
|------|---------|
| `src/config/mediapipeReferenceData.js` | Reference values for ideal posture and face-mesh |
| `src/hooks/useFaceMeshDetection.js` | Face-mesh detection hook (468 landmarks) |
| `src/hooks/useInterviewAnalytics.js` | Combined pose + face detection with scoring |
| `src/components/ui/InterviewAnalyticsPanel.jsx` | Enhanced UI showing all metrics |

### Reference Data Library Contents

#### 1. Pose Landmarks (33 points)
```javascript
POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  // ... all 33 landmarks
}
```

#### 2. Face-Mesh Landmarks (478 points)
```javascript
FACE_LANDMARKS = {
  LEFT_EYE: [263, 249, 390, ...], // 16 points
  RIGHT_EYE: [33, 7, 163, ...],   // 16 points
  LEFT_IRIS: [474, 475, 476, 477],
  RIGHT_IRIS: [469, 470, 471, 472],
  LIPS_OUTER: [...],              // 20 points
  // ... all 478 landmarks
}
```

#### 3. Ideal Posture Values
```javascript
POSTURE_REFERENCE = {
  shoulder: {
    maxSlopeThreshold: 0.03,      // Good posture
    moderateSlopeThreshold: 0.06, // Acceptable
    poorSlopeThreshold: 0.10,     // Needs improvement
  },
  spine: {
    maxForwardHeadThreshold: 0.05,
    // ...
  },
  head: {
    maxTiltThreshold: 0.025,
    // ...
  },
  hands: {
    fidgetingThreshold: 0.05,
    // ...
  }
}
```

#### 4. Ideal Face Values
```javascript
FACE_REFERENCE = {
  eyes: {
    openEyeEARMin: 0.20,     // Eye Aspect Ratio
    blinkThreshold: 0.18,
    // ...
  },
  orientation: {
    maxYawThreshold: 15,     // degrees
    maxPitchThreshold: 10,
    maxRollThreshold: 10,
    // ...
  }
}
```

#### 5. Scoring Weights
```javascript
SCORING_WEIGHTS = {
  posture: { weight: 0.30 },     // 30% of overall score
  attention: { weight: 0.40 },   // 40% of overall score
  bodyLanguage: { weight: 0.20 }, // 20% of overall score
  expression: { weight: 0.10 },   // 10% of overall score
}
```

### Metrics Calculated

| Category | Metrics |
|----------|---------|
| **Posture** | Shoulder alignment, spine alignment, head position, slouching detection |
| **Eye Contact** | Eye Aspect Ratio (EAR), blink count, attention score |
| **Face Orientation** | Yaw (left/right), Pitch (up/down), Roll (tilt) |
| **Body Language** | Fidgeting detection, hand movement, overall stability |
| **Expression** | Eyebrow position (neutral/raised/furrowed) |

### How the Comparison Works

1. **Real-time Detection**: Every 100ms, the system captures pose and face landmarks
2. **Reference Comparison**: Each metric is compared against ideal values
3. **Score Calculation**: Weighted scores are calculated
4. **Feedback Generation**: Contextual feedback messages are generated

```javascript
// Example: Shoulder alignment scoring
if (shoulderSlope > POSTURE_REFERENCE.shoulder.poorSlopeThreshold) {
  shoulderScore = 40;
  shoulderStatus = 'poor';
} else if (shoulderSlope > POSTURE_REFERENCE.shoulder.moderateSlopeThreshold) {
  shoulderScore = 70;
  shoulderStatus = 'fair';
}
```

---

## API Endpoints

### Dataset API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/datasets/interview` | POST | Save interview training data |
| `/api/datasets/analytics` | POST | Save posture/face analytics data |
| `/api/datasets` | GET | List all datasets (admin) |
| `/api/datasets/statistics` | GET | Get dataset statistics |
| `/api/datasets/export/:type` | GET | Export datasets as JSONL |
| `/api/datasets/:id` | DELETE | Delete a dataset |

---

## Usage Instructions

### For Developers

1. **Using the Interview Analytics Hook**:
```jsx
import useInterviewAnalytics from '../hooks/useInterviewAnalytics';

const MyComponent = () => {
  const { 
    metrics,
    poseMetrics,
    isInitialized,
    exportCollectedData 
  } = useInterviewAnalytics(videoRef.current, {
    enablePose: true,
    enableFace: true,
    collectData: true,
    interviewId: 'interview_123'
  });
  
  // Access scores
  console.log(metrics.scores.overall);
  console.log(metrics.feedback.posture);
};
```

2. **Using the Dataset Collector**:
```jsx
import { InterviewDatasetCollector } from '../services/interviewDatasetService';

const collector = new InterviewDatasetCollector({
  jobRole: 'Software Engineer',
  experienceLevel: 'Mid-level',
});

// Record Q&A pairs
collector.recordQAPair(question, answer, evaluation);

// Export for training
const jsonl = collector.toJSONL();
```

### For System Administrators

1. Navigate to **System Admin Dashboard**
2. Click on **Training Data Manager** tab
3. View statistics and distributions
4. Export data in JSONL format for LLM training

---

## Research Applications

### For LLM Fine-Tuning

The collected data can be used to fine-tune LLMs for:
- Generating interview questions
- Evaluating candidate answers
- Providing feedback
- Creating interviewer personas

### For Posture Analysis Research

The reference data library enables:
- Comparison studies of posture during interviews
- XAI (Explainable AI) for posture recommendations
- Training classification models for posture quality
- Creating confusion matrices for posture states

---

## Files Modified

- `src/pages/live-interview-session/components/CandidateVideoFeed.jsx` - Updated to use new analytics hook
- `src/pages/live-interview-session/index.jsx` - Added full metrics support
- `src/services/apiClient.js` - Added datasets API methods
- `server/src/routes/index.js` - Registered dataset routes

---

## NEW: Research Tools for External Data Collection

Based on additional supervisor guidance, we've created comprehensive tools for collecting data from external sources.

### Research Tools Page (`/research-tools`)

Access: System Admin → Quick Actions → "Research Tools" button

| Tool | Purpose |
|------|---------|
| **Video Recorder** | Record reference videos of good/bad posture |
| **Video Analyzer** | Analyze recorded videos with MediaPipe, extract metrics |
| **LLM Data Aggregator** | Import, combine, and export interview data from multiple sources |
| **Dataset Downloader** | Links and instructions for external datasets |

### External Data Sources for LLM Training

#### Hugging Face Datasets
- `Anthropic/AnthropicInterviewer` - 1,250 interview transcripts
- `ali-alkhars/interviews` - 2,290 Q&A pairs

#### Kaggle Datasets
- Software Engineering Interview Questions (250 Q&A)
- Coding Questions with Solutions (5,000+ problems)

#### Manual Collection Sources
- Glassdoor.com (real interview questions by company)
- Indeed.com (interview questions by job title)
- InterviewBit.com (technical Q&A)

### Video Recording Protocol for MediaPipe

Record reference videos in these categories:
1. **Posture** - Good (straight) vs Bad (slouching)
2. **Head Position** - Good (level) vs Bad (tilted)
3. **Eye Contact** - Good (camera focus) vs Bad (looking away)
4. **Hand Movement** - Good (calm) vs Bad (fidgeting)

See `docs/RESEARCH_DATA_COLLECTION_GUIDE.md` for detailed instructions.

---

## Next Steps / Future Enhancements

1. **XAI Techniques**: Add SHAP/LIME explanations for model decisions
2. **Confusion Matrix**: Implement classification metrics visualization
3. **Real-time Alerts**: Add audio/visual alerts for posture issues
4. **Video Recording**: Save video clips for training data
5. **A/B Testing**: Compare different reference value sets

---

## Technical Notes

- MediaPipe models are loaded from Google CDN
- Detection runs at 10 FPS (100ms intervals) for performance
- Data is stored in Firebase Firestore collections:
  - `trainingDatasets_interviews`
  - `trainingDatasets_analytics`
  - `trainingDatasets_metadata`

---

*Document created: January 28, 2026*
*Implementation by: InterviewAI Pro Development Team*
