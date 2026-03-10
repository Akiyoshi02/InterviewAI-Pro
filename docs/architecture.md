# Architecture

## System shape

InterviewAI Pro is a full-stack interview platform with four major layers:

| Layer | Path | Responsibility |
| --- | --- | --- |
| Frontend SPA | `src/` | Candidate, company, recruiter, reviewer, and system-admin UI |
| Backend API | `server/src/` | Authentication, role enforcement, interview orchestration, review workflow, notifications |
| Data and realtime | Firebase via `server/src/services/firebaseData.service.js` | Primary persistence, notifications, realtime updates |
| Optional AI services | Ollama, local Whisper, MediaPipe | Question generation, summaries, transcription, pose analysis |

## Frontend responsibilities

The frontend is a React 18 + Vite single-page application.

Major areas:
- `src/pages/candidate-*`: candidate workflow
- `src/pages/company-*`: company, recruiter, and reviewer workspaces
- `src/pages/system-admin-*`: platform admin views
- `src/components/`: shared UI and route-guard components
- `src/services/apiClient.js`: HTTP API client and token/header handling

## Backend responsibilities

The backend is an Express application started from:
- `server/src/server.js`

Major backend concerns:
- auth and organization context
- interview lifecycle management
- application status transitions
- reviewer assignment and review reminders
- meeting-link validation for hiring interviews
- moderation, upload authorization, and audit logging

Key folders:
- `server/src/controllers/`: request handlers
- `server/src/routes/`: route registration and RBAC entry points
- `server/src/middleware/`: validation, rate limiting, security
- `server/src/services/`: Firebase access, email, scheduling, AI integration
- `server/src/utils/`: role, review, scheduling, and lifecycle helpers

## Role model

Current product roles:

| Role | Primary purpose |
| --- | --- |
| Candidate | practice and hiring interviews, applications, scheduling |
| Company Admin | organization management, hiring oversight |
| Recruiter | operational hiring workflow, scheduling, reviewer assignment |
| Reviewer | assigned evaluation workflow and structured feedback |
| System Admin | platform-level operations |

Recruiter/reviewer split:
- Recruiter owns pipeline movement, scheduling, reviewer assignment, and reminders.
- Reviewer is assignment-scoped and should focus on evidence review and feedback only.

## Core workflows

### Practice interview
1. Candidate creates practice interview.
2. Backend stores practice configuration.
3. Candidate starts session.
4. Questions are generated or built from structured templates.
5. Transcript, scores, and notes are stored for later review.

### Hiring interview
1. Company moves application into interview workflow.
2. Recruiter schedules the interview.
3. System generates per-interview meeting access and sends candidate join email near start time.
4. Interview runs with recruiter/reviewer access controls.
5. Reviewer submits assigned feedback.
6. Recruiter sees review status, reminders, and completion state.

### Reviewer workflow
1. Recruiter assigns reviewer(s) to an interview.
2. Review requests are visible in `/company-reviews`.
3. Automated and manual reminders operate on the review request state.
4. Reviewer submits structured feedback against the assigned interview.

## Realtime and notifications

The backend publishes organization/admin/candidate realtime updates through Firebase-backed helpers in:
- `server/src/services/firebaseData.service.js`

Notification channels currently include:
- in-app notifications
- email notifications
- review reminders
- interview lifecycle notifications

## Health endpoints

Useful runtime checks:
- `GET /health`
- `GET /api/health`
- `GET /api/ai/health`

## Boundaries and assumptions

- AI services are optional for baseline local development, but some scoring or transcription behavior degrades without them.
- Frontend static hosting and backend API hosting are separate concerns.
- Firebase project configuration is required for realistic end-to-end operation.
