# SME Calibration Workflow

## Overview

This document describes the SME (Subject Matter Expert) calibration workflow implemented to satisfy **FR8** and the contextual report: comparison of AI scores with SME ratings, calibration, and override mechanisms.

## Features

1. **Comparison of AI vs SME scores** – Side-by-side view of AI evaluation and SME (reviewer) ratings.
2. **Override semantics** – SME can choose to use their overall score as the final score (override AI).
3. **Traceability** – Each review stores AI overall score at review time, SME overall score, and override flag.
4. **Final score** – Interview document has `finalOverallScore` and `finalScoreSource` ('AI' | 'SME').

## Data Model

### Interview (Firestore `interviews`)

- **existing:** `overallScore`, `evaluation`, `readinessLevel`
- **added:** `finalOverallScore` (number, when SME override used), `finalScoreSource` ('AI' | 'SME')

When no SME override exists, downstream code should use `overallScore` as the effective score. When `finalScoreSource === 'SME'`, use `finalOverallScore`.

### Review (Firestore `interviewReviews`)

- **existing:** `interviewId`, `reviewerId`, `reviewerRole`, `score`, `decision`, `strengths`, `weaknesses`, `notes`
- **added for calibration:**
  - `rating` (0–10, SME overall)
  - `technicalScore`, `communicationScore`, `problemSolvingScore`, `culturalFitScore` (0–10 each)
  - `recommendation` (STRONG_YES, YES, MAYBE, NO, STRONG_NO, UNDECIDED)
  - `aiOverallScoreAtReview` (snapshot of interview.overallScore when review was submitted)
  - `smeOverallScore` (0–100, derived from rating or category average)
  - `overrideOverall` (boolean – use SME score as final)

## API

### GET `/api/reviews/:interviewId/me`

Returns the current user's review for the interview (single review or `{ success: true, review: null }`).

### POST `/api/reviews/:interviewId`

Submit or update review. Body can include:

- `rating`, `technicalScore`, `communicationScore`, `problemSolvingScore`, `culturalFitScore` (0–10)
- `notes`, `recommendation`
- `overrideOverall` (boolean)

When `overrideOverall === true` and `smeOverallScore` is present, the backend updates the interview with `finalOverallScore` and `finalScoreSource: 'SME'`.

## Frontend

- **Company Dashboard → Interview Review** (`InterviewReviewEnhanced.jsx`):
  - **AI vs SME** tab: side-by-side AI evaluation vs SME review scores and agreement (difference in overall score).
  - **AI Evaluation** tab: rubric-tied explainability — Technical Skills, Communication Skills, Problem Solving, Cultural Fit (score + feedback per criterion), plus Strengths, Areas for Improvement, Recommendations, and Detailed Feedback. Raw JSON is available in a collapsible section.
  - **My Review** tab: category scores, recommendation, notes, and **Use my overall score as the final score (override AI)** checkbox.
  - Info bar shows **Final Score** and “SME override” when applicable.
- **apiClient:** `getReviewForInterview(interviewId)`, `submitReview({ interviewId, ...payload })` including `overrideOverall`.

## Backward compatibility

- Existing reviews (no calibration fields) still load; missing fields default to 0 or null.
- `ReviewerPanel` and other callers that use `reviews.submit(interviewId, { score, decision, notes })` continue to work; new fields are optional.
- Interviews without `finalOverallScore` / `finalScoreSource` behave as before (effective score = `overallScore`).

---

*Implemented: January 2026. Aligns with FR8 and contextual report Section 2.7.3 (calibration of SMEs, review and override mechanisms).*
