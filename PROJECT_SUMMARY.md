# PROJECT_SUMMARY

## What This Repo Is

InterviewAI Pro is a React/Vite single-page app plus an Express backend that uses Firebase (Auth + Firestore + Realtime DB) and optional local AI services (Ollama for LLM, Faster-Whisper for speech-to-text, MediaPipe for pose analysis). See `README.md`, `src/`, `server/`.

## High-Level Architecture (Runtime)

- **Frontend (SPA)**: Vite + React app mounted from `index.html` → `src/index.jsx` → `src/App.jsx` → `src/Routes.jsx`.
- **Backend API + sockets**: Express + Socket.IO server in `server/src/server.js`, with routes mounted in `server/src/routes/index.js`.
- **Data stores**:
  - Firestore collections and helpers in `server/src/services/firebaseData.service.js`
  - Firebase Realtime DB usage for “live session events” in `server/src/services/firebaseData.service.js` (`recordRealtimeEvent`) and Socket.IO handlers in `server/src/socket/interview.socket.js`.
- **Optional local AI services**:
  - Ollama (frontend calls via `src/services/llmClient.js`, backend calls via `server/src/services/llm.service.js`)
  - Local Whisper server (Python) in `server/whisper_server.py`, called by `src/services/localWhisperService.js`
  - MediaPipe pose detection (browser) via `src/hooks/usePoseDetection.js` and stored locally via `src/services/poseAnalyticsStorage.js`

## Repository Layout

- Frontend app code: `src/`
  - Routing: `src/Routes.jsx`
  - Auth state/context: `src/contexts/AuthContext.jsx`
  - Firebase client wrapper: `src/config/firebase.js`
  - Backend API client: `src/services/apiClient.js`
  - AI interviewer (local Ollama): `src/services/aiInterviewer.js` and `src/hooks/useAIInterviewer.js`
  - Live session page: `src/pages/live-interview-session/index.jsx` and `src/pages/live-interview-session/components/*`
  - Practice setup wizard: `src/pages/practice-interview-setup/index.jsx` and `src/pages/practice-interview-setup/components/*`
  - Company dashboard + recruiting tools: `src/pages/company-dashboard/index.jsx` and `src/pages/company-dashboard/components/*`
  - Candidate dashboard + assistant: `src/pages/candidate-dashboard/index.jsx` and `src/pages/candidate-dashboard/components/*`
- Backend app code: `server/src/`
  - Entry point: `server/src/server.js`
  - Firebase Admin + env loading: `server/src/config/firebase.js`, `server/src/config/env.js`
  - Auth middleware: `server/src/middleware/auth.middleware.js`
  - Route mounting: `server/src/routes/index.js`
  - Controllers: `server/src/controllers/*.controller.js`
  - Stores/services (Firestore + Realtime DB + Ollama + moderation): `server/src/services/*.service.js`
  - Socket.IO handlers: `server/src/socket/interview.socket.js`
- Static assets (PWA-ish): `public/` (see `public/manifest.json`, `public/assets/`)
- CI deploy to GitHub Pages: `.github/workflows/deploy.yml`
- Engineering notes: `docs/*.md` (these are not authoritative over implementation; compare with current code in `src/` and `server/src/`)

## How To Run Locally

### Frontend

- Install deps: `npm install` (root `package.json`)
- Start dev server: `npm start` (root `package.json`, Vite config in `vite.config.mjs` uses port `4028`)

### Backend

- Install deps: `cd server && npm install` (server `server/package.json`)
- Create env file: copy `server/.env.example` → `server/.env` (loaded by `server/src/config/env.js`)
- Start API/sockets: `cd server && npm run dev` (server `server/package.json`)

### Optional: Ollama (LLM)

- Frontend calls Ollama directly via `src/services/llmClient.js` (uses `VITE_OLLAMA_URL`, `VITE_OLLAMA_MODEL` from root `.env`).
- Backend calls Ollama directly via `server/src/services/llm.service.js` (uses `OLLAMA_URL`, `OLLAMA_MODEL` from `server/.env.example` / `server/.env`).

### Optional: Local Whisper (speech-to-text)

- Whisper server: `server/whisper_server.py` (deps in `server/requirements.txt`)
- Frontend uses it only when `VITE_LOCAL_WHISPER_URL` is set (see `src/services/localWhisperService.js`).

## Environment Variables (Verified Keys)

### Frontend (`.env`)

Keys present in the repo’s root `.env` (values intentionally not shown): `VITE_API_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_DATABASE_URL`, `VITE_OLLAMA_URL`, `VITE_OLLAMA_MODEL` (root `.env`, Firebase client usage in `src/config/firebase.js`, API base usage in `src/services/apiClient.js`).

Optional key used by code: `VITE_LOCAL_WHISPER_URL` (checked in `src/services/localWhisperService.js`).

### Backend (`server/.env`)

Keys present in `server/.env` (values intentionally not shown): `PORT`, `NODE_ENV`, `FRONTEND_URL`, `FIREBASE_DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT_PATH`, `SIGHTENGINE_USER`, `SIGHTENGINE_SECRET`, `OLLAMA_URL`, `OLLAMA_MODEL`, `WHISPER_SERVER_URL`, `WHISPER_MODEL`, `STUN_SERVER`, `LOG_LEVEL` (`server/.env.example`, loaded by `server/src/config/env.js`).

## Auth Model (Frontend ↔ Backend)

- Frontend uses Firebase Auth (email/password + Google) via `src/config/firebase.js` and maintains app-level state in `src/contexts/AuthContext.jsx`.
- Backend verifies Firebase ID tokens in `server/src/middleware/auth.middleware.js` using `server/src/config/firebase.js` (`verifyFirebaseToken`).
- After token verification, the backend loads the user profile from Firestore (`userStore.getByUid`) and attaches org context if `primaryOrganizationId` exists (`server/src/middleware/auth.middleware.js`, stores in `server/src/services/firebaseData.service.js`).
- Route gating in the SPA is based on `user.accountType` via `src/components/ProtectedRoute.jsx` and the route table in `src/Routes.jsx`.

## Registration + Upload Moderation

Registration is a two-step sync:

1. User signs up/signs in with Firebase on the frontend (`src/config/firebase.js`, used by `src/pages/register/index.jsx` and `src/pages/login/index.jsx`).
2. Frontend calls backend `POST /api/auth/register` via `src/services/apiClient.js` (route in `server/src/routes/auth.routes.js`, implementation in `server/src/controllers/auth.controller.js`).

Backend registration behavior (verified in `server/src/controllers/auth.controller.js`):

- **Candidate** requires `profilePhoto` + `resumeFile` uploads and validates:
  - Profile photo moderation via Sightengine when configured (`server/src/services/imageModeration.service.js`)
  - Resume parsing + heuristics + optional LLM verification (`server/src/services/documentModeration.service.js`, `server/src/services/llm.service.js`)
  - Resume hash dedupe against existing users (`userStore.findByResumeHash` in `server/src/services/firebaseData.service.js`)
- **Company** requires `companyLogo` + `companyProof` uploads and validates similarly (logo moderation + document verification + hash dedupe via `userStore.findByVerificationHash`).
- Uploads are stored under `server/uploads/*` and served statically at `/uploads` (`server/src/server.js`, upload paths in `server/src/middleware/upload.middleware.js`).
- Company registration creates an organization + admin membership (`organizationStore.create`, `organizationMemberStore.addMember` in `server/src/services/firebaseData.service.js`, orchestrated in `server/src/controllers/auth.controller.js`).

There are also standalone moderation endpoints (no auth) under `/api/uploads/moderate/*` (`server/src/routes/upload.routes.js`, called by `src/services/apiClient.js`).

## Data Model (Firestore + Realtime DB)

Firestore collections used by the backend (defined in `server/src/services/firebaseData.service.js`):

- `users`
- `interviews` (+ subcollections: `questions`, `poseData`)
- `webrtcSessions`
- `organizations`
- `organizationMembers`
- `jobs`
- `invitations`
- `interviewReviews`
- `activityLogs`

Realtime Database usage (defined in `server/src/services/firebaseData.service.js`):

- Events written under `sessions/{interviewId}/events` and `sessions/{interviewId}/lastEvent` by `recordRealtimeEvent` (called from Socket.IO handlers in `server/src/socket/interview.socket.js`).

## Backend API Surface (Route Map)

Routes are mounted in `server/src/routes/index.js` and mirrored by client helpers in `src/services/apiClient.js`.

Key groups:

- Auth: `server/src/routes/auth.routes.js` (`/api/auth/*`)
- Interviews: `server/src/routes/interview.routes.js` (`/api/interviews/*`) with orchestration in `server/src/controllers/interview.controller.js`
- Analytics: `server/src/routes/analytics.routes.js` (`/api/analytics/*`) with stats in `server/src/services/firebaseData.service.js` (`analyticsStore`)
- Video/WebRTC: `server/src/routes/video.routes.js` (`/api/video/*`) with ICE config in `server/src/controllers/video.controller.js`
- Organizations: `server/src/routes/organization.routes.js` (`/api/organizations/*`)
- Jobs: `server/src/routes/job.routes.js` and public job browsing via `server/src/routes/public.routes.js`
- Invitations: `server/src/routes/invitation.routes.js` and public preview via `server/src/routes/public.routes.js`
- Pipeline: `server/src/routes/pipeline.routes.js`
- Reviews: `server/src/routes/review.routes.js`
- Activity: `server/src/routes/activity.routes.js`
- Upload moderation: `server/src/routes/upload.routes.js`

## Core User Flows

### Practice Interview (Candidate)

- Setup wizard collects role/type/duration/personality/voice/advanced settings in `src/pages/practice-interview-setup/index.jsx`.
- Creates a `PRACTICE` interview on the backend via `src/services/apiClient.js` → `POST /api/interviews/create` (`server/src/controllers/interview.controller.js`).
- Saves config to localStorage as `interviewConfig` and navigates to the live session (`src/pages/practice-interview-setup/index.jsx`).

### Live Interview Session (Candidate)

- Loads config from localStorage, else falls back to backend interview record (`src/pages/live-interview-session/index.jsx`).
- Runs the local AI interviewer (Ollama) via `src/hooks/useAIInterviewer.js` and `src/services/aiInterviewer.js`.
- Optionally records microphone audio and transcribes with local Whisper when enabled (`src/services/audioRecorderService.js`, `src/services/localWhisperService.js`).
- Pose detection runs in-browser (`src/hooks/usePoseDetection.js`) and snapshots are persisted to localStorage (`src/services/poseAnalyticsStorage.js`).
- Backend sync for question/answer persistence is done opportunistically via `src/services/interviewBackendSync.js` from inside `src/hooks/useAIInterviewer.js`.

Notable implementation detail: the UI “end session” flow concludes the local AI interview and navigates away without calling the backend `POST /api/interviews/:id/end` endpoint (`src/pages/live-interview-session/index.jsx`, backend endpoint in `server/src/routes/interview.routes.js` / `server/src/controllers/interview.controller.js`).

### Company Recruiting Flows

- Company dashboard data loads interviews + metrics via `src/pages/company-dashboard/index.jsx` (backend endpoints in `server/src/routes/interview.routes.js`, `server/src/routes/analytics.routes.js`).
- Organization admin features use `/api/organizations/*` and `/api/activity` (`src/pages/company-dashboard/components/OrganizationAdminPanel.jsx`, backend in `server/src/routes/organization.routes.js`, `server/src/routes/activity.routes.js`).
- Job CRUD uses `/api/jobs` and public jobs use `/api/public/jobs` (`src/pages/company-dashboard/components/InvitationManager.jsx`, `src/pages/jobs/index.jsx`, backend in `server/src/routes/job.routes.js`, `server/src/routes/public.routes.js`).
- Invitations use `/api/invitations` and public preview uses `/api/public/invitations/:token` (`src/pages/invite/index.jsx`, `server/src/routes/invitation.routes.js`, `server/src/routes/public.routes.js`).
- Pipeline uses `/api/pipeline` (`src/pages/company-dashboard/components/CandidatePipeline.jsx`, backend in `server/src/routes/pipeline.routes.js`).
- Reviews use `/api/reviews/:interviewId` (`src/pages/company-dashboard/components/ReviewerPanel.jsx`, backend in `server/src/routes/review.routes.js`).

## AI/ML Components (Where They Live)

- **Local LLM client (frontend)**: `src/services/llmClient.js`, with higher-level helpers in `src/services/llmServices.js` and hook wrapper `src/hooks/useLLM.js`.
- **AI interviewer (frontend)**: `src/services/aiInterviewer.js`, orchestrated by `src/hooks/useAIInterviewer.js`.
- **Local LLM service (backend)**: `server/src/services/llm.service.js` (used by `server/src/controllers/interview.controller.js` and document moderation in `server/src/services/documentModeration.service.js`).
- **Whisper server (Python)**: `server/whisper_server.py` with deps in `server/requirements.txt`.
  - Frontend sends `language` and `task` form fields (`src/services/localWhisperService.js`), but the current server transcribe call is hard-coded to `language="en"` (`server/whisper_server.py`).
- **Pose detection**: `src/hooks/usePoseDetection.js` using `@mediapipe/tasks-vision` and remote model/wasm assets.

## Deployment

- GitHub Pages build+deploy workflow: `.github/workflows/deploy.yml` (builds with `npm run build` and deploys `build/`).
- Vite build output is configured to `build/` and `base: "./"` for GitHub Pages subpaths (`vite.config.mjs`).
- SPA redirect support: `public/_redirects` (useful on hosts that honor it; GitHub Pages itself uses its own routing constraints).

## Testing

- Frontend/unit test runner: Vitest (`vitest.config.js`, script `npm test` in root `package.json`).
- Example tests:
  - `src/__tests__/protectedRoute.test.jsx`
  - `server/src/__tests__/activity.controller.test.js` (also uses Vitest imports)

Note: the backend `server/package.json` defines `npm test` via Jest, but the existing backend test file uses Vitest-style imports (`server/package.json`, `server/src/__tests__/activity.controller.test.js`).

## Operational / Safety Notes

- Sensitive files are gitignored: `.env`, `server/.env`, uploads, logs, service account keys (`.gitignore`). Keep `firebase-service-account.json` / `server/firebase-service-account.json` out of version control.
- The backend writes logs to `logs/error.log` and `logs/combined.log` via Winston (`server/src/utils/logger.js`), which typically resolves under `server/logs/` when run from the server directory.

## Known Implementation Mismatches (From Code)

- `RealTimeFeedbackPanel` calls `useLLM().evaluateAnswer` with a single object, but `evaluateAnswer` in `src/services/llmServices.js` expects `(question, answer, context)`; the component falls back to mock feedback on failure (`src/pages/live-interview-session/components/RealTimeFeedbackPanel.jsx`, `src/hooks/useLLM.js`, `src/services/llmServices.js`).
- Candidate dashboard expects analytics fields like `averageScore`/`insightsCount`, but the backend dashboard stats currently return interview counts only (`src/pages/candidate-dashboard/index.jsx`, `server/src/services/firebaseData.service.js`).

