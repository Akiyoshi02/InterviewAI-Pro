# Comprehensive Interview Body Language Detection Guide

## Overview

This document outlines the complete detection and scoring system implemented for analyzing interview body language. The system uses MediaPipe's PoseLandmarker (33 body landmarks) and FaceLandmarker (478 facial landmarks) to provide real-time analysis.

---

## Table of Contents

1. [Posture Analysis](#1-posture-analysis)
2. [Facial Analysis](#2-facial-analysis)
3. [Eye Contact & Gaze](#3-eye-contact--gaze)
4. [Hand & Body Movement](#4-hand--body-movement)
5. [Scoring System](#5-scoring-system)
6. [Reference Thresholds](#6-reference-thresholds)
7. [Usage Guide](#7-usage-guide)

---

## 1. Posture Analysis

### 1.1 Shoulder Metrics

| Metric | Description | Ideal Value | Threshold |
|--------|-------------|-------------|-----------|
| **Shoulder Slope** | Y-axis difference between shoulders | 0 (level) | <0.015 = Excellent, <0.030 = Good |
| **Shoulder Width** | Distance between shoulders (openness) | 0.38+ | <0.26 = Closed posture |
| **Shoulder Angle** | Rotation angle of shoulder line | 0° | <5° = Level |
| **Shoulder Tension** | Height relative to ears | 0.12 | <0.06 = Tense |

**What We Detect:**
- Uneven shoulders (indicates tension/poor posture)
- Closed shoulders (defensive body language)
- Raised shoulders (stress indicator)
- Shoulder roll (slouching)

### 1.2 Spine/Back Alignment

| Metric | Description | Ideal Value | Threshold |
|--------|-------------|-------------|-----------|
| **Forward Lean** | Z-axis position relative to hips | 0 to 0.02 | >0.08 = Poor posture |
| **Lateral Lean** | X-axis deviation from center | 0 | >0.06 = Noticeable |
| **Vertical Angle** | Angle from vertical | 0° | <10° = Good |
| **Upright Status** | Combined alignment check | true | Boolean |

**What We Detect:**
- Slouching (forward lean)
- Side leaning (lateral lean)
- Torso rotation (turned away)
- Engagement (slight forward lean shows interest)

### 1.3 Head Position

| Metric | Description | Ideal Value | Threshold |
|--------|-------------|-------------|-----------|
| **Head Tilt** | Left/right tilt (roll) | 0° | <7° = Slight |
| **Head Turn** | Left/right rotation (yaw) | 0° | <20° = Slight |
| **Head Pitch** | Up/down angle | 0° | <12° = Level |
| **Forward Position** | Turtle neck detection | 0 | >0.06 = Fair |

**What We Detect:**
- Head tilting (may indicate confusion or interest)
- Looking away (turned head)
- Looking up/down (disengagement or submission)
- Forward head posture (common computer posture issue)

---

## 2. Facial Analysis

### 2.1 Eye Metrics (EAR - Eye Aspect Ratio)

| Metric | Description | Normal Range | Detection |
|--------|-------------|--------------|-----------|
| **EAR** | Ratio of eye height to width | 0.20-0.35 | Blink <0.16 |
| **Blink Rate** | Blinks per minute | 15-20 | >25 = Stressed |
| **Eye Openness** | How open eyes appear | 0.26+ | <0.20 = Drowsy |
| **Eye Asymmetry** | Difference between eyes | <0.03 | >0.10 = Winking |

**What We Detect:**
- Blinks (normal, excessive, or prolonged)
- Drowsiness (low EAR sustained)
- Alertness (normal open eyes)
- Squinting (concentration or difficulty seeing)
- Eye asymmetry (winking or facial issues)

### 2.2 Face Orientation

| Metric | Description | Ideal Range | Warning Threshold |
|--------|-------------|-------------|-------------------|
| **Yaw** | Left/right rotation | ±8° | >25° = Looking away |
| **Pitch** | Up/down tilt | ±8° | >20° = Looking up/down |
| **Roll** | Head tilt | ±5° | >18° = Significant tilt |

**What We Detect:**
- Direct gaze (facing camera)
- Slight turns (minor deviation)
- Looking away (significant turn)
- Head tilt (interest or confusion)

### 2.3 Mouth Analysis (MAR - Mouth Aspect Ratio)

| Metric | Description | Threshold | Detection |
|--------|-------------|-----------|-----------|
| **MAR** | Ratio of mouth height to width | 0.05-0.50 | Speaking >0.12 |
| **Speaking** | Active speech detection | >0.12 | Boolean |
| **Lip Compression** | Pressed lips | <0.03 | Stress indicator |
| **Mouth Openness** | Open/closed state | 0.05 | closed/open/wide |

**What We Detect:**
- Speaking detection (useful for turn-taking)
- Yawning (wide open mouth)
- Lip compression (stress/tension)
- Natural mouth position

### 2.4 Smile Detection

| Metric | Description | Threshold | Notes |
|--------|-------------|-----------|-------|
| **Is Smiling** | Smile detected | Lip corner lift >0.015 | Boolean |
| **Smile Intensity** | Strength of smile | 0-1 scale | 0.7+ = Broad |
| **Smile Symmetry** | Left/right balance | >0.85 | Genuine indicator |

**What We Detect:**
- Genuine smiles (symmetric)
- Forced smiles (asymmetric)
- Smile intensity (slight to broad)
- Neutral expression

### 2.5 Eyebrow Analysis

| Metric | Description | Threshold | Emotion |
|--------|-------------|-----------|---------|
| **Raised** | Eyebrows lifted | >0.012 | Surprise/Interest |
| **Furrowed** | Eyebrows lowered | <-0.008 | Concern/Concentration |
| **Asymmetric** | One raised | >0.025 | Skepticism |

**What We Detect:**
- Raised eyebrows (surprise, interest)
- Furrowed eyebrows (confusion, concentration)
- Skeptical expression (one raised)
- Neutral position

---

## 3. Eye Contact & Gaze

### 3.1 Iris Tracking

| Metric | Description | Good Range | Warning |
|--------|-------------|------------|---------|
| **Iris Position** | Position within eye socket | Center (0.5, 0.5) | Deviation >0.15 |
| **Gaze Direction** | Where person is looking | center | left/right/up/down |
| **At Camera** | Looking at camera | true | false = Aversion |

### 3.2 Eye Contact Quality

| Level | Percentage | Description |
|-------|------------|-------------|
| Excellent | 80%+ | Strong engagement |
| Good | 65-80% | Acceptable contact |
| Fair | 50-65% | Room for improvement |
| Poor | 35-50% | Significant aversion |
| Avoiding | <35% | May appear evasive |

---

## 4. Hand & Body Movement

### 4.1 Hand Movement Detection

| Metric | Description | Threshold | Status |
|--------|-------------|-----------|--------|
| **Movement Velocity** | Frame-to-frame movement | <0.015 | Calm |
| **Average Movement** | 30-frame average | <0.035 | Moderate |
| **Fidgeting** | Sustained movement | >0.04 | Fidgeting detected |
| **Hand Visibility** | Hands in frame | 0-1 | Higher = Better |

### 4.2 Body Stability

| Metric | Description | Good Range | Warning |
|--------|-------------|------------|---------|
| **Stability Score** | Overall stillness | >0.8 | <0.6 = Restless |
| **Body Movement** | Average movement | <0.012 | >0.045 = Active |
| **Is Stable** | Composite check | true | false = Movement |

### 4.3 Nervous Behavior Indicators

| Behavior | Detection Method | Threshold |
|----------|------------------|-----------|
| **Swaying** | Lateral oscillation | >0.03/second |
| **Bouncing** | Vertical oscillation | >0.02/second |
| **Self-touching** | Hand near face | <0.08 distance |
| **Object fidgeting** | Small rapid movements | >0.05/frame |

---

## 5. Scoring System

### 5.1 Component Weights

| Component | Weight | Sub-components |
|-----------|--------|----------------|
| **Posture** | 25% | Shoulders (40%), Spine (40%), Head (20%) |
| **Eye Contact** | 25% | Gaze (50%), Orientation (30%), Openness (20%) |
| **Expression** | 15% | Smile (50%), Eyebrows (30%), Natural (20%) |
| **Body Language** | 15% | Hand steadiness (50%), Stability (50%) |
| **Engagement** | 10% | Lean (30%), Eye contact (40%), Expression (30%) |
| **Professional Presence** | 10% | Framing (50%), Camera angle (30%), Consistency (20%) |

### 5.2 Score Levels

| Score Range | Level | Color | Feedback Priority |
|-------------|-------|-------|-------------------|
| 90-100 | Excellent | Green | Positive reinforcement |
| 75-89 | Good | Light Green | Minor suggestions |
| 60-74 | Fair | Yellow | Improvement tips |
| 40-59 | Needs Improvement | Orange | Active guidance |
| 0-39 | Poor | Red | Immediate correction |

---

## 6. Reference Thresholds

### Quick Reference Card

```
POSTURE
├── Shoulder Slope: <0.03 (Good), <0.06 (Fair), >0.10 (Poor)
├── Forward Lean: -0.02 to 0.02 (Good), >0.08 (Poor)
└── Head Level: <7° tilt (Good), >18° (Significant)

EYES
├── EAR (Open): 0.20-0.35
├── EAR (Blink): <0.16
├── Blink Rate: 15-20/min (Normal), >25/min (Stressed)
└── Drowsy: EAR <0.20 sustained

FACE ORIENTATION
├── Yaw (Good): <15°, (Looking Away): >35°
├── Pitch (Good): <12°, (Extreme): >30°
└── Roll (Good): <10°, (Significant): >20°

GAZE
├── Center Tolerance: ±0.15
├── At Camera: Deviation <0.10
└── Looking Away: Deviation >0.25

MOUTH
├── Closed: MAR <0.05
├── Speaking: MAR >0.12
└── Wide Open: MAR >0.35

MOVEMENT
├── Calm: <0.015/frame
├── Fidgeting: >0.04/frame sustained
└── Stable: <0.025 average movement
```

---

## 7. Usage Guide

### 7.1 Accessing the Detection System

1. Navigate to **System Admin Dashboard**
2. Click on **Research Tools** tab
3. Select **Video Recorder** sub-tab
4. Click **Start Camera**
5. MediaPipe will initialize automatically

### 7.2 Understanding the Metrics Panel

The comprehensive metrics panel shows:

1. **Overall Score Banner**: Composite interview presence score (0-100)
2. **Component Breakdown**: Individual scores for each category
3. **Detailed Metrics**: Raw values for all detection parameters
4. **Status Indicators**: Color-coded status for quick assessment

### 7.3 Recording Reference Videos

To build your MediaPipe reference library:

1. Select a **Category** (Posture, Head Position, Eye Contact, etc.)
2. Choose **Example Type** (Good or Bad)
3. Add a descriptive name
4. Click **Start Recording**
5. Demonstrate the behavior for 5-15 seconds
6. Click **Stop Recording**
7. Download or analyze the recording

### 7.4 Interpreting Results

| Color | Meaning | Action |
|-------|---------|--------|
| 🟢 Green | Excellent/Good | Maintain current behavior |
| 🟡 Yellow | Fair | Minor adjustment needed |
| 🟠 Orange | Needs Improvement | Focus on this area |
| 🔴 Red | Poor | Immediate attention required |

---

## Technical Implementation

### Files Modified/Created

| File | Purpose |
|------|---------|
| `src/config/mediapipeReferenceData.js` | Complete reference data library |
| `src/pages/research-tools/components/VideoRecorder.jsx` | Comprehensive detection UI |
| `src/hooks/useInterviewAnalytics.js` | Combined analytics hook |
| `src/components/ui/InterviewAnalyticsPanel.jsx` | Display component |

### Key Functions

| Function | Purpose |
|----------|---------|
| `calculateEAR()` | Eye Aspect Ratio calculation |
| `calculateMAR()` | Mouth Aspect Ratio calculation |
| `calculateFaceOrientation()` | Yaw/Pitch/Roll calculation |
| `calculateShoulderMetrics()` | Shoulder alignment analysis |
| `calculateSpineAlignment()` | Spine/back posture analysis |
| `calculateHandMetrics()` | Hand movement/fidgeting detection |
| `calculateGazeMetrics()` | Eye contact quality |
| `calculateSmileMetrics()` | Smile detection |
| `calculateEyebrowMetrics()` | Eyebrow position analysis |
| `calculateStabilityMetrics()` | Overall body stability |
| `calculateCompositeScore()` | Combined interview score |

---

## Research Applications

This system enables:

1. **Data Collection**: Record and label reference videos
2. **Analysis**: Extract quantitative metrics from behavior
3. **Comparison**: Compare against ideal reference values
4. **Training**: Build datasets for ML model improvement
5. **Evaluation**: Score interview performance objectively

---

## Future Enhancements

- [ ] Audio analysis (speech patterns, filler words)
- [ ] Micro-expression detection
- [ ] Gesture recognition (hand signals)
- [ ] Multi-person detection
- [ ] Historical trend analysis
- [ ] Personalized baseline calibration

---

*Last Updated: January 28, 2026*
*Version: 2.0.0 - Comprehensive Edition*
