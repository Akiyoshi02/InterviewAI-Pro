# Interview Evaluation Export Schema (FR12 / Interoperability)

This document describes the **structured output** used when exporting interview evaluations and reviews for recruiters (e.g. from the Interview Review modal → “Export report”). The format is designed to support **interoperability** with external ATS/HR systems and analysis tools (Contextual Report 2.7.3 point 9, FR12).

## Schema version

- **Current:** `1.0`
- **Export trigger:** Recruiter/SME clicks “Export report” in `InterviewReviewEnhanced` (company dashboard).

## Top-level fields

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | string | Schema version (e.g. `"1.0"`) |
| `exportDate` | string (ISO 8601) | When the export was generated |
| `interviewId` | string | Interview document ID |
| `candidate` | object | Candidate summary (id, fullName, email) |
| `jobRole` | string | Role for the interview |
| `startedAt` | string \| null | Interview start (ISO 8601) |
| `endedAt` | string \| null | Interview end (ISO 8601) |
| `status` | string | e.g. COMPLETED |
| `overallScore` | number \| null | AI overall score (0–100) |
| `finalOverallScore` | number \| null | Final score (AI or SME override) |
| `finalScoreSource` | string | `"AI"` or `"SME"` |
| `readinessLevel` | string \| null | e.g. Intermediate |
| `evaluation` | object \| null | Overall AI evaluation (rubric criteria, strengths, weaknesses, recommendations, detailedFeedback) |
| `perQuestionEvaluation` | array | Per-answer evaluations (questionId, question, answer, score, starAnalysis, strengths, weaknesses) |
| `reviewSummary` | object | SME review summary (rating, category scores, recommendation, overrideOverall, notesExcerpt) |

## Evaluation object (overall)

When present, `evaluation` contains:

- `technicalSkills`, `communicationSkills`, `problemSolving`, `culturalFit`: each `{ score?, feedback? }`
- `strengths`, `weaknesses`, `recommendations`: arrays of strings
- `detailedFeedback`: string

## Per-question evaluation

Each item in `perQuestionEvaluation`:

- `questionId`, `question`, `answer`
- `score`: 0–10
- `starAnalysis`: `{ situation?, task?, action?, result? }` each `{ present?, quality?, feedback? }`
- `strengths`, `weaknesses`: arrays

## Review summary

- `rating`: 0–10 (SME overall)
- `technicalScore`, `communicationScore`, `problemSolvingScore`, `culturalFitScore`: 0–10
- `recommendation`: e.g. STRONG_YES, YES, MAYBE, NO, UNDECIDED
- `overrideOverall`: boolean
- `notesExcerpt`: first 200 characters of notes (or null)

## File format

- **Export format:** JSON (UTF-8)
- **Filename pattern:** `interview-evaluation-{interviewId}-{YYYY-MM-DD}.json`
- **Usage:** Download from browser; can be consumed by external tools or re-imported for analysis.

## Alignment with report

- **FR12:** Exports and reporting — organized output for analysis.
- **2.7.3 point 9:** Structured outputs that assist with interoperability.

---

*Defined: January 2026.*
