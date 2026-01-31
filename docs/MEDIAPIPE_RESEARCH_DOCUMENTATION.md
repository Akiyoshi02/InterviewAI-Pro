# MediaPipe Body Language Detection System
## Complete Research Documentation for Interview Analysis

---

## Executive Summary

This document provides comprehensive technical documentation for the research-grade body language detection system implemented using Google's MediaPipe. The system tracks **553 landmarks** in real-time for comprehensive interview performance analysis, providing quantitative metrics for academic research and practical application in professional interview settings.

**System Version:** 3.0.0 - Complete Research Edition  
**Last Updated:** January 28, 2026  
**Author:** InterviewAI Pro Research Team

---

## Table of Contents

1. [Introduction & Research Background](#1-introduction--research-background)
2. [System Architecture](#2-system-architecture)
3. [Detection Models](#3-detection-models)
4. [Landmark Specifications](#4-landmark-specifications)
5. [Metrics Calculations](#5-metrics-calculations)
6. [Scoring System](#6-scoring-system)
7. [Data Collection & Export](#7-data-collection--export)
8. [Validation & Accuracy](#8-validation--accuracy)
9. [Research Applications](#9-research-applications)
10. [Technical Reference](#10-technical-reference)
11. [References](#11-references)

---

## 1. Introduction & Research Background

### 1.1 Research Context

Nonverbal communication plays a crucial role in professional interviews, accounting for up to 55% of communication impact according to Mehrabian's research (1971). This system provides objective, quantitative measurement of nonverbal cues that influence interview outcomes.

### 1.2 Research Objectives

1. **Quantify** body language metrics during video interviews
2. **Track** 553 anatomical landmarks in real-time
3. **Score** interview performance across 5 key dimensions
4. **Export** data for statistical analysis and research

### 1.3 Key Research Questions Addressed

- How do posture and body alignment affect perceived professionalism?
- What eye contact patterns correlate with positive interviewer impressions?
- How does hand visibility and steadiness relate to perceived confidence?
- Can facial expressions be quantified to assess engagement?

---

## 2. System Architecture

### 2.1 Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | React 18 + Vite | User interface |
| Detection | MediaPipe Tasks-Vision | AI-powered landmark detection |
| Processing | WebGL + GPU | Real-time computation |
| Storage | IndexedDB + localStorage | Client-side data persistence |
| Export | JSON/CSV | Research data export |

### 2.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      VIDEO INPUT (Webcam)                        │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MediaPipe Detection Layer                     │
│  ┌─────────────────┬──────────────────┬──────────────────────┐  │
│  │  PoseLandmarker │  FaceLandmarker  │    HandLandmarker    │  │
│  │  (33 landmarks) │ (478 landmarks)  │  (21 × 2 landmarks)  │  │
│  └─────────────────┴──────────────────┴──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Metrics Calculation Engine                    │
│  • Geometric calculations (angles, distances, ratios)           │
│  • Temporal analysis (stability, movement over time)            │
│  • Composite scoring (weighted multi-factor analysis)           │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Output Layer                                │
│  ┌─────────────┬─────────────────┬────────────────────────────┐ │
│  │ Real-time   │ Session Data    │ Research Reports           │ │
│  │ Visualization│ Collection     │ (JSON/CSV/TXT)             │ │
│  └─────────────┴─────────────────┴────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Detection Models

### 3.1 PoseLandmarker (Body Skeleton)

**Landmarks:** 33  
**Model:** `pose_landmarker_lite`  
**Delegate:** GPU (WebGL)

Tracks the full body skeleton including:
- Face reference points (nose, eyes, ears, mouth corners)
- Upper body (shoulders, elbows, wrists, hands)
- Lower body (hips, knees, ankles, feet)

### 3.2 FaceLandmarker (Face Mesh)

**Landmarks:** 478 (468 face + 10 iris)  
**Model:** `face_landmarker`  
**Delegate:** GPU (WebGL)

Provides detailed facial analysis including:
- Eye contours and iris tracking
- Eyebrow positions
- Nose and lip boundaries
- Face oval and jaw line

### 3.3 HandLandmarker (Hand Skeleton)

**Landmarks:** 21 per hand (42 total)  
**Model:** `hand_landmarker`  
**Delegate:** GPU (WebGL)

Tracks detailed hand anatomy:
- Wrist position
- All finger joints (MCP, PIP, DIP)
- Fingertips for gesture recognition

---

## 4. Landmark Specifications

### 4.1 Pose Landmarks (33 Total)

| Index | Name | Description |
|-------|------|-------------|
| 0 | NOSE | Tip of nose |
| 1-6 | EYES | Left/Right eye inner, center, outer |
| 7-8 | EARS | Left/Right ear tragion |
| 9-10 | MOUTH | Left/Right mouth corners |
| 11-12 | SHOULDERS | Left/Right shoulder joints |
| 13-14 | ELBOWS | Left/Right elbow joints |
| 15-16 | WRISTS | Left/Right wrist joints |
| 17-22 | HANDS | Pinky, index, thumb base points |
| 23-24 | HIPS | Left/Right hip joints |
| 25-32 | LEGS/FEET | Knees, ankles, heels, foot index |

### 4.2 Hand Landmarks (21 per Hand)

| Index | Name | Description |
|-------|------|-------------|
| 0 | WRIST | Wrist center |
| 1-4 | THUMB | CMC, MCP, IP, TIP |
| 5-8 | INDEX | MCP, PIP, DIP, TIP |
| 9-12 | MIDDLE | MCP, PIP, DIP, TIP |
| 13-16 | RING | MCP, PIP, DIP, TIP |
| 17-20 | PINKY | MCP, PIP, DIP, TIP |

### 4.3 Key Face Landmarks

| Feature | Landmark Indices | Count |
|---------|-----------------|-------|
| Left Eye | 263, 249, 390, 373, 374, 380... | 16 |
| Right Eye | 33, 7, 163, 144, 145, 153... | 16 |
| Left Iris | 473-477 | 5 |
| Right Iris | 468-472 | 5 |
| Lips Outer | 61, 146, 91, 181... | 20 |
| Lips Inner | 78, 95, 88, 178... | 20 |
| Face Oval | 10, 338, 297, 332... | 36 |

---

## 5. Metrics Calculations

### 5.1 Eye Aspect Ratio (EAR)

Used for blink detection and eye openness measurement.

**Formula:**
```
EAR = vertical_distance / horizontal_distance
    = distance(eye_top, eye_bottom) / distance(eye_left, eye_right)
```

**Reference Values:**
| State | EAR Range |
|-------|-----------|
| Closed | < 0.16 |
| Narrowed | 0.16 - 0.18 |
| Normal | 0.22 - 0.26 |
| Wide Open | > 0.35 |

### 5.2 Mouth Aspect Ratio (MAR)

Used for speech detection.

**Formula:**
```
MAR = vertical_distance / horizontal_distance
    = distance(upper_lip, lower_lip) / distance(mouth_left, mouth_right)
```

**Reference Values:**
| State | MAR Range |
|-------|-----------|
| Closed | < 0.05 |
| Slightly Open | 0.05 - 0.12 |
| Speaking | 0.12 - 0.18 |
| Wide Open | > 0.35 |

### 5.3 Face Orientation (Yaw, Pitch, Roll)

**Yaw (Left-Right Turn):**
```javascript
yaw = atan2(eyeCenter.x - noseTip.x, |noseTip.z - eyeCenter.z|) × (180/π)
```

**Pitch (Up-Down Tilt):**
```javascript
pitch = atan2(noseHeight - expectedNoseHeight, faceHeight) × (180/π)
```

**Roll (Head Tilt):**
```javascript
roll = atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) × (180/π)
```

### 5.4 Shoulder Metrics

**Slope (Level Detection):**
```javascript
slope = |leftShoulder.y - rightShoulder.y|
```

| Slope | Status | Score |
|-------|--------|-------|
| < 0.015 | Excellent | 100 |
| < 0.030 | Good | 85 |
| < 0.050 | Fair | 70 |
| < 0.080 | Poor | 50 |
| ≥ 0.100 | Critical | 30 |

### 5.5 Finger Curl (Hand Analysis)

**Formula:**
```javascript
angle1 = angle(MCP, PIP, DIP)
angle2 = angle(PIP, DIP, TIP)
curl = 1 - (average(angle1, angle2) / 180)
// Result: 0 = extended, 1 = fully curled
```

### 5.6 Body Stability

**Movement Magnitude:**
```javascript
movement = average(
  distance(currentNose, previousNose),
  distance(currentLeftShoulder, previousLeftShoulder),
  distance(currentRightShoulder, previousRightShoulder)
)
```

**Reference Values:**
| Movement | Status | Score |
|----------|--------|-------|
| < 0.005 | Very Still | 100 |
| < 0.012 | Stable | 90 |
| < 0.025 | Normal | 75 |
| < 0.045 | Active | 60 |
| < 0.070 | Restless | 40 |
| > 0.100 | Excessive | 20 |

---

## 6. Scoring System

### 6.1 Component Weights

| Component | Weight | Justification |
|-----------|--------|---------------|
| Eye Contact | 25% | Primary connection indicator |
| Posture | 20% | Professional appearance |
| Stability | 20% | Composure indicator |
| Expression | 20% | Engagement/approachability |
| Hands | 15% | Trust and confidence |

### 6.2 Overall Score Formula

```
Overall = (Posture × 0.20) + (Eye Contact × 0.25) + (Expression × 0.20) 
        + (Hands × 0.15) + (Stability × 0.20)
```

### 6.3 Component Score Breakdown

#### Posture Score (0-100)
```
Posture = (Shoulder Score × 0.40) + (Spine Score × 0.40) + (Head Score × 0.20)
```

#### Eye Contact Score (0-100)
```
Eye Contact = (Orientation Score × 0.50) + (Gaze Score × 0.30) + (Eye Openness × 0.20)
```

#### Expression Score (0-100)
```
Expression = (Naturalness × 0.40) + (Smile Score × 0.30) + (Mouth State × 0.30)
```

#### Hands Score (0-100)
```
Hands = (Visibility × 0.40) + (Steadiness × 0.35) + (Openness × 0.25)
```

#### Stability Score (0-100)
Based on body movement magnitude with thresholds defined in section 5.6.

### 6.4 Score Levels

| Score Range | Level | Interpretation |
|-------------|-------|----------------|
| 90-100 | Excellent | Outstanding interview presence |
| 75-89 | Good | Positive impression likely |
| 60-74 | Fair | Acceptable with room for improvement |
| 40-59 | Needs Improvement | Notable issues to address |
| 0-39 | Poor | Significant concerns |

---

## 7. Data Collection & Export

### 7.1 Session Recording

The system captures metrics at **2 Hz (every 500ms)**, providing:
- Real-time scores for all 5 components
- Raw landmark data
- Derived metrics (EAR, MAR, angles, etc.)
- Detection status for all models

### 7.2 Export Formats

#### JSON Export
Complete structured data including:
- Metadata (date, duration, sample count)
- Summary statistics
- Full time-series data

#### CSV Export
Tabular format with 40+ columns:
- Timestamps
- All component scores
- Raw metric values
- Binary indicators (blinking, speaking, smiling, etc.)

#### Research Report
Human-readable report including:
- Session summary
- Average scores
- Behavioral analysis percentages
- Scoring methodology
- Academic references

### 7.3 Data Schema

```javascript
{
  metadata: {
    exportDate: "ISO timestamp",
    sessionDuration: "seconds",
    totalDataPoints: number,
    sampleRate: "2 Hz",
    modelsUsed: ["PoseLandmarker", "FaceLandmarker", "HandLandmarker"],
    totalLandmarks: 553
  },
  summary: {
    avgPostureScore: number,
    avgEyeContactScore: number,
    avgExpressionScore: number,
    avgHandsScore: number,
    avgStabilityScore: number,
    avgOverallScore: number,
    eyeContactPercentage: "percent",
    smilingPercentage: "percent",
    speakingPercentage: "percent",
    stablePercentage: "percent"
  },
  data: [/* time-series array */]
}
```

---

## 8. Validation & Accuracy

### 8.1 MediaPipe Model Accuracy

According to Google's documentation:
- **PoseLandmarker:** ~95% accuracy on standard benchmarks
- **FaceLandmarker:** ~98% accuracy for face detection
- **HandLandmarker:** ~94% accuracy for hand detection

### 8.2 System Validation

| Metric | Method | Expected Accuracy |
|--------|--------|-------------------|
| Eye Contact | Face orientation + gaze | ±5° yaw/pitch |
| Blink Detection | EAR threshold | ~95% |
| Speech Detection | MAR threshold | ~90% |
| Shoulder Level | Slope calculation | ±1° |
| Hand Gesture | Finger curl analysis | ~85% |

### 8.3 Limitations

1. **Lighting Conditions:** Performance degrades in low light
2. **Occlusion:** Partial visibility reduces accuracy
3. **Distance:** Optimal range 0.5-2m from camera
4. **Frame Rate:** Dependent on hardware (target 30+ FPS)

---

## 9. Research Applications

### 9.1 Use Cases

1. **Interview Training:** Objective feedback for candidates
2. **Communication Research:** Quantitative nonverbal analysis
3. **HR Analytics:** Interview quality assessment
4. **Educational Assessment:** Presentation skills evaluation

### 9.2 Research Metrics

The system provides data suitable for:
- **Descriptive Statistics:** Mean, SD, range for all metrics
- **Time-Series Analysis:** Temporal patterns in behavior
- **Correlation Studies:** Relationships between metrics
- **Comparative Analysis:** Between-subject comparisons

### 9.3 Ethical Considerations

- All processing is client-side (no data sent to servers)
- Users must consent to recording
- Data export is under user control
- No personally identifiable information stored

---

## 10. Technical Reference

### 10.1 File Structure

```
src/
├── config/
│   └── mediapipeReferenceData.js  (1400+ lines)
│       ├── Landmark definitions
│       ├── Reference thresholds
│       ├── Scoring weights
│       └── Calculation functions
│
└── pages/research-tools/components/
    └── VideoRecorder.jsx  (2000+ lines)
        ├── MediaPipe initialization
        ├── Detection loop
        ├── Metrics calculation
        ├── Session recording
        └── Export functions
```

### 10.2 Key Functions

| Function | Purpose |
|----------|---------|
| `calculateEAR()` | Eye Aspect Ratio |
| `calculateMAR()` | Mouth Aspect Ratio |
| `calculateFaceOrientation()` | Yaw, Pitch, Roll |
| `calculateShoulderMetrics()` | Shoulder alignment |
| `calculateSpineAlignment()` | Posture analysis |
| `analyzeHand()` | Complete hand analysis |
| `detectHandGesture()` | Gesture classification |
| `calculateStability()` | Body movement tracking |

### 10.3 Performance Optimization

- GPU delegation for all models
- Sparse face mesh drawing (every 15th point)
- 500ms sampling interval for data collection
- Efficient state management with React hooks

### 10.4 Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome 90+ | Full |
| Firefox 90+ | Full |
| Edge 90+ | Full |
| Safari 15+ | Partial (no WebGPU) |

---

## 11. References

### Academic Sources

1. Mehrabian, A. (1971). *Silent Messages: Implicit Communication of Emotions and Attitudes*. Wadsworth Publishing Company.

2. Gifford, R., Ng, C. F., & Wilkinson, M. (1985). Nonverbal cues in the employment interview: Links between applicant qualities and interviewer judgments. *Journal of Applied Psychology*, 70(4), 729-736.

3. Ekman, P., & Friesen, W. V. (1978). *Facial Action Coding System: A Technique for the Measurement of Facial Movement*. Consulting Psychologists Press.

4. Soukupová, T., & Čech, J. (2016). Real-time eye blink detection using facial landmarks. In *21st Computer Vision Winter Workshop*.

### Technical Documentation

5. Google MediaPipe Documentation. (2023). https://developers.google.com/mediapipe

6. MediaPipe Solutions Guide. (2023). https://developers.google.com/mediapipe/solutions/guide

### Related Research

7. DeGroot, T., & Motowidlo, S. J. (1999). Why visual and vocal interview cues can affect interviewers' judgments and predict job performance. *Journal of Applied Psychology*, 84(6), 986-993.

8. Burgoon, J. K., Guerrero, L. K., & Floyd, K. (2016). *Nonverbal Communication*. Routledge.

---

## Appendix A: Gesture Recognition Criteria

| Gesture | Criteria |
|---------|----------|
| Open Palm | All 5 fingers extended, openness > 0.7 |
| Closed Fist | No fingers extended, openness < 0.2 |
| Pointing | Only index extended |
| Peace Sign | Index + middle extended |
| Thumbs Up | Only thumb extended |
| Relaxed | Openness 0.4-0.7 |

---

## Appendix B: Quick Reference Card

### Score Interpretation

| Overall Score | Recommendation |
|---------------|----------------|
| 90+ | Excellent - Maintain current behavior |
| 75-89 | Good - Minor refinements suggested |
| 60-74 | Fair - Focus on weakest component |
| 40-59 | Improve - Practice recommended |
| < 40 | Significant training needed |

### Key Thresholds

| Metric | Good | Concerning |
|--------|------|------------|
| Eye Contact | Yaw < 10° | Yaw > 25° |
| Shoulder Level | Slope < 0.03 | Slope > 0.08 |
| Stability | Movement < 0.012 | Movement > 0.045 |
| Eye Openness | EAR > 0.22 | EAR < 0.18 |

---

**Document Version:** 3.0.0  
**Classification:** Research Documentation  
**Status:** Production Ready

*This documentation supports the MediaPipe-based interview analysis system developed for academic research in nonverbal communication assessment.*
