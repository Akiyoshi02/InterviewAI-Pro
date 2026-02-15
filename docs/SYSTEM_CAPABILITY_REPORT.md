# SYSTEM CAPABILITY REPORT

## Inputs Used
- Repo root: `D:\Campus Work\Projects\Interviewer`
- Frontend start command: `npm start`
- Backend start command: `npm run dev --prefix server`
- Frontend URL: `http://localhost:4028`
- Backend URL: `http://localhost:3000`
- Admin setup token header: `x-admin-setup-token = <REDACTED>` (`server/src/routes/admin.routes.js:39-56`)
- Runtime test accounts available in data layer (passwords not available in repo): candidate/company admin/system admin discovered; recruiter/reviewer not present (`docs/_runtime_outputs/runtime_user_role_discovery.json`)

## 1) Repo Identity

### 1.1 Commit identity
```text
$ git rev-parse HEAD
f716391636586345c331103d83fcd7cdaae2ee67
```
Source: `docs/_runtime_outputs/systemcap_current_01_git_rev_parse_head.txt`

### 1.2 Top-level folders and purpose
| Folder | Purpose | Evidence |
|---|---|---|
| `.github/` | CI and deploy workflows | `.github/workflows/ci.yml:1-55`, `.github/workflows/deploy.yml:1-52` |
| `.playwright-cli/` | Local browser automation artifacts/config | `docs/_runtime_outputs/systemcap_top_level_dirs.txt` |
| `build/` | Frontend production build output | `vite.config.mjs:12-15`, `docs/_runtime_outputs/systemcap_current_04_npm_run_build_root.txt` |
| `docs/` | Project documentation and audit outputs | `docs/_runtime_outputs/systemcap_top_level_dirs.txt` |
| `logs/` | Runtime log folder | `docs/_runtime_outputs/systemcap_top_level_dirs.txt` |
| `public/` | Static assets | `README.md:52-54` |
| `server/` | Express backend, controllers/routes/middleware, Whisper server | `README.md:48-51`, `server/package.json:2-11` |
| `src/` | React frontend application | `README.md:42-47`, `package.json:62-67` |
| `node_modules/` | Installed dependencies | `docs/_runtime_outputs/systemcap_top_level_dirs.txt` |

### 1.3 Project purpose and stack
- Project identity: `InterviewAI Pro`, AI interview coaching platform (`README.md:1-4`).
- Frontend: React/Vite/Tailwind, charts and PDF export libs (`package.json:29-61`, `package.json:63-67`).
- Backend: Express + Firebase Admin + Socket.IO + security middleware (`server/package.json:12-33`).
- AI components: Ollama LLM + local Whisper + MediaPipe (`README.md:12-13`, `server/src/services/llm.service.js:19-21`, `server/whisper_server.py:72-90`, `src/hooks/useInterviewAnalytics.js:147-159`).
- Data layer: Firestore collections for users/interviews/jobs/applications/invitations/reviews/settings (`server/src/services/firebaseData.service.js:15-30`).

## 2) Verification Commands + Raw Outputs

### 2.1 Mandatory commands status
| Command | Result | Evidence |
|---|---|---|
| `git rev-parse HEAD` | PASS | `docs/_runtime_outputs/systemcap_current_01_git_rev_parse_head.txt` |
| `npm install` | PASS | `docs/_runtime_outputs/systemcap_current_02_npm_install_root.txt` |
| `npm test -- --run` | PASS (frontend tests) | `docs/_runtime_outputs/systemcap_current_03_npm_test_root.txt` |
| `npm run build` | PASS (warnings only) | `docs/_runtime_outputs/systemcap_current_04_npm_run_build_root.txt` |
| `npm install --prefix server` | PASS | `docs/_runtime_outputs/systemcap_current_05_npm_install_server.txt` |
| `npm --prefix server test` | FAIL (1 suite) | `docs/_runtime_outputs/systemcap_current_06_npm_test_server.txt` |
| `npm start` | FAIL in this run (port already in use) | `docs/_runtime_outputs/systemcap_current_07_npm_start_root.txt` |
| `npm run dev --prefix server` | FAIL in this run (port already in use) | `docs/_runtime_outputs/systemcap_current_08_npm_run_dev_server.txt` |

### 2.2 Raw outputs (trimmed only for noise)

#### `npm install`
```text
up to date, audited 716 packages in 8s
23 vulnerabilities (2 low, 15 moderate, 4 high, 2 critical)
```
Source: `docs/_runtime_outputs/systemcap_current_02_npm_install_root.txt`

#### `npm test -- --run`
```text
Test Files  7 passed (7)
Tests       50 passed (50)
Duration    1.20s
```
Source: `docs/_runtime_outputs/systemcap_current_03_npm_test_root.txt`

#### `npm run build`
```text
vite v5.0.0 building for production...
✓ built in 9.16s
(!) Some chunks are larger than 2000 kB after minification.
```
Source: `docs/_runtime_outputs/systemcap_current_04_npm_run_build_root.txt`

#### `npm install --prefix server`
```text
up to date, audited 615 packages in 4s
9 vulnerabilities (1 moderate, 8 high)
```
Source: `docs/_runtime_outputs/systemcap_current_05_npm_install_server.txt`

#### `npm --prefix server test` (failed)
```text
FAIL src/__tests__/atsLifecycle.integration.test.js
SyntaxError: The requested module '../services/firebaseData.service.js' does not provide an export named 'systemSettingsStore'
at src/__tests__/atsLifecycle.integration.test.js:428:33
Test Suites: 1 failed, 5 passed, 6 total
```
Source: `docs/_runtime_outputs/systemcap_current_06_npm_test_server.txt`

#### `npm start` (frontend)
```text
error when starting dev server:
Error: Port 4028 is already in use
```
Source: `docs/_runtime_outputs/systemcap_current_07_npm_start_root.txt`

#### `npm run dev --prefix server` (backend)
```text
Error: listen EADDRINUSE: address already in use :::3000
[nodemon] app crashed - waiting for file changes before starting...
```
Source: `docs/_runtime_outputs/systemcap_current_08_npm_run_dev_server.txt`

#### Existing running services verification
```text
TCP 0.0.0.0:3000 LISTENING
TCP 0.0.0.0:4028 LISTENING
GET /health -> HTTP/1.1 200 OK
```
Sources: `docs/_runtime_outputs/systemcap_current_port_3000.txt`, `docs/_runtime_outputs/systemcap_current_port_4028.txt`, `docs/_runtime_outputs/systemcap_current_09_health_check.txt`

### 2.3 Backend test failure root cause + minimal fix
- Failing import chain: `server/src/__tests__/atsLifecycle.integration.test.js:428`.
- Mock module omits `systemSettingsStore`: `server/src/__tests__/atsLifecycle.integration.test.js:388-404`.
- Controller imports `systemSettingsStore`: `server/src/controllers/interview.controller.js:2-12`.
- Real export exists: `server/src/services/firebaseData.service.js:3242-3258`.

Minimal fix:
1. In `server/src/__tests__/atsLifecycle.integration.test.js:388-404`, extend the mocked export object with `systemSettingsStore`.
2. Implement at least `systemSettingsStore.get` in the mock to return default settings used by interview controller feature-flag paths.

Status: NOT IMPLEMENTED in this audit (reporting only).

## 3) Complete Feature Matrix

| Feature | Status (Implemented/Partial/Missing/Placeholder/Not Verified) | UI route(s) | API route(s) | Data model touched | Evidence (file:lines and/or runtime output) |
|---|---|---|---|---|---|
| Auth + RBAC roles | Partial | `/login`, protected routes in `src/Routes.jsx` | `/api/auth/*`, role middleware on protected routes | `users`, `organizationMembers`, `organizations` | `src/Routes.jsx:64-239`, `src/components/ProtectedRoute.jsx:11-84`, `server/src/middleware/auth.middleware.js:14-40`, `server/src/middleware/auth.middleware.js:134-181`, `server/src/middleware/admin.middleware.js:6-21`, runtime roles missing recruiter/reviewer: `docs/_runtime_outputs/runtime_user_role_discovery.json` |
| Consent collection (recording) | Partial | `/live-interview-session` (consent gate screen) | `PATCH /api/interviews/:id/recording-consent` | `interviews.recordingConsentGivenAt`, `interviews.recordingConsentVersion`, session storage key `recording_consent_*` | `src/pages/live-interview-session/components/RecordingConsentScreen.jsx:73-105`, `src/pages/live-interview-session/index.jsx:463-481`, `server/src/routes/interview.routes.js:128-146`, `server/src/controllers/interview.controller.js:348-366` |
| Practice mode flow | Partial | `/practice-interview-setup` -> `/live-interview-session` -> `/candidate-dashboard` | `POST /api/interviews/create`, `POST /api/interviews/:id/start`, `POST /api/interviews/:id/question/answer`, `POST /api/interviews/:id/end` | `interviews`, `interviews/{id}/questions`, realtime interview feed | `src/pages/practice-interview-setup/index.jsx:135-165`, `server/src/routes/interview.routes.js:45-52`, `server/src/routes/interview.routes.js:152-229`, `server/src/controllers/interview.controller.js:275-293`, `server/src/controllers/interview.controller.js:604-671`, runtime: create 201 + start/end 500 due LLM fetch: `docs/_runtime_outputs/runtime_authenticated_flow_probe.json`, `docs/_runtime_outputs/runtime_backend_dev_stdout.txt` |
| Hiring mode flow (jobs/applications/invitations/pipeline) | Partial | `/company-jobs`, `/jobs/:id`, `/company-dashboard`, `/invite` | `POST /api/jobs`, `POST /api/jobs/:jobId/apply`, `PATCH /api/applications/:id`, `POST /api/invitations`, `POST /api/invitations/accept`, `GET/PATCH /api/pipeline` | `jobs`, `jobApplications`, `invitations`, `interviews`, `activityLogs` | `server/src/routes/job.routes.js:78-153`, `server/src/routes/application.routes.js:21-163`, `server/src/routes/invitation.routes.js:16-50`, `server/src/routes/pipeline.routes.js:14-37`, `server/src/controllers/invitation.controller.js:339-360`, runtime partial success: `docs/_runtime_outputs/runtime_authenticated_flow_probe.json` |
| Live interview session + STAR evaluation | Partial | `/live-interview-session` | `POST /api/interviews/:id/start`, `POST /api/interviews/:id/question/answer`, `POST /api/interviews/:id/end` | `interviews`, `questions.feedback`, `questions.followUpQuestion` | STAR scoring prompt: `server/src/services/llm.service.js:265-303`; answer evaluation saved: `server/src/controllers/interview.controller.js:637-651`; runtime start/end blocked by Ollama `ECONNREFUSED`: `docs/_runtime_outputs/runtime_backend_dev_stdout.txt` |
| Scoring + explanations (structured output) | Partial | Interview review/evaluation UI (`/company-dashboard` review tab) | Scoring called inside interview start/end/answer handlers | `questions.score`, `questions.feedback`, `interviews.evaluation`, `interviews.overallScore`, `interviews.readinessLevel` | JSON-only prompt + parse: `server/src/services/llm.service.js:232-258`, `server/src/services/llm.service.js:288-312`; persistence: `server/src/controllers/interview.controller.js:463-469`, `server/src/controllers/interview.controller.js:645-651`; no AJV/Zod schema enforcement found in backend scoring path: `server/src/services/llm.service.js:102-110` |
| Audio/video capture + persistence (what is actually stored) | Partial | `/live-interview-session`, company review video tab | `PATCH /api/interviews/:id/recording-consent`, `POST /api/video/session/:interviewId`, `POST /api/interviews/:id/question/answer` | `interviews` (consent, transcript), `questions.answerAudioUrl`, `webrtcSessions`, `interviews/{id}/poseData` | WebRTC session store: `server/src/controllers/video.controller.js:25-54`, `server/src/services/firebaseData.service.js:675-700`; answer audio persisted: `server/src/controllers/interview.controller.js:627-633`, `server/src/services/firebaseData.service.js:488-490`; interview root has no `recordingUrl`: `server/src/services/firebaseData.service.js:400-428`; UI expects `interview.recordingUrl`: `src/pages/company-dashboard/components/InterviewReviewEnhanced.jsx:622-639` |
| Speech-to-text + nonverbal analysis | Partial | `/live-interview-session` | Socket events: `audio:chunk`, `pose:data`; optional local Whisper HTTP server | Local storage (`pose_analytics_*`), Firestore `interviews/{id}/poseData` | Whisper server exists: `server/whisper_server.py:72-90`, frontend whisper client: `src/services/localWhisperService.js:95-139`; socket transcription is placeholder text: `server/src/socket/interview.socket.js:170-177`; pose persisted server-side: `server/src/socket/interview.socket.js:181-189`, `server/src/services/firebaseData.service.js:703-717`; local pose snapshots persisted in browser storage: `src/services/poseAnalyticsStorage.js:16-33` |
| Candidate/company/admin dashboards + fairness/calibration | Partial | `/candidate-dashboard`, `/company-dashboard`, `/system-admin-dashboard` | `/api/analytics/*`, `/api/admin/fairness-calibration` | `interviews`, `reviews`, analytics aggregates, system admin stats | Candidate data load: `src/pages/candidate-dashboard/index.jsx:101-126`; company data load: `src/pages/company-dashboard/index.jsx:98-132`; fairness panel API call: `src/pages/system-admin-dashboard/components/FairnessCalibrationPanel.jsx:31-37`; fairness backend computation: `server/src/controllers/admin.controller.js:1701-1792`; runtime fairness endpoint 200: `docs/_runtime_outputs/runtime_authenticated_flow_probe.json` |
| Exports/reporting | Partial | `/company-analytics`, `/system-admin-dashboard` training data section | `GET /api/datasets/export/:type`, `DELETE /api/datasets/:id` | Dataset collections + local generated files (PDF/CSV/JSON/JSONL) | Company PDF/CSV implemented: `src/pages/company-dashboard/components/CandidateProgressDashboard.jsx:169-176`, `src/pages/company-dashboard/components/CandidateProgressDashboard.jsx:849-1015`, `src/pages/company-dashboard/components/CandidateProgressDashboard.jsx:1436-1454`; dataset export API: `server/src/routes/dataset.routes.js:63-78`, `server/src/controllers/dataset.controller.js:286-351`; admin training data export UI: `src/pages/system-admin-dashboard/components/TrainingDataManager.jsx:304-329` |
| Scheduling source of truth (`scheduledFor`, timezone, meeting link) | Missing | Scheduling widget renders these fields | No interview schedule/reschedule/cancel endpoints found | Would be `interviews` if implemented | UI reads fields: `src/pages/candidate-dashboard/components/SchedulingWidget.jsx:27`, `src/pages/candidate-dashboard/components/SchedulingWidget.jsx:57`; create schema omits fields: `server/src/middleware/inputValidation.middleware.js:762-767`; interview create omits fields: `server/src/controllers/interview.controller.js:275-293`; interview routes have no scheduling actions: `server/src/routes/interview.routes.js:45-229` |
| Data retention/deletion controls (self-service vs admin) | Partial | Candidate application list and system admin operations panels | `DELETE /api/applications/:id`, `GET/POST /api/admin/data-retention/*`, `DELETE /api/datasets/:id` | `jobApplications`, `interviews`, `activityLogs`, `platformAuditLogs`, dataset collections | Candidate withdrawal endpoint: `server/src/routes/application.routes.js:67-75`; admin retention APIs: `server/src/routes/admin.routes.js:358-365`, retention logic: `server/src/controllers/admin.controller.js:2137-2300`; no authenticated self-service account-delete route in `auth.routes`: `server/src/routes/auth.routes.js:110-220` |
| CI/CD + Docker + tests + security middleware | Partial | N/A | N/A | N/A | CI/workflows present: `.github/workflows/ci.yml:1-55`, `.github/workflows/deploy.yml:1-52`; Docker files absent: `docs/_runtime_outputs/systemcap_docker_presence.txt`; security middleware active: `server/src/middleware/security.middleware.js:133-193`; tests present with backend suite failing: `docs/_runtime_outputs/systemcap_current_03_npm_test_root.txt`, `docs/_runtime_outputs/systemcap_current_06_npm_test_server.txt` |

## 4) Placeholder Hunting

| Placeholder or non-functional UI action | Current behavior | Evidence | Existing route/API it should call |
|---|---|---|---|
| Company dashboard `handleViewRecording` | Logs only; no navigation/API | `src/pages/company-dashboard/index.jsx:334-337` | Could navigate to `/company-interviews` and fetch via `GET /api/interviews/:id` (`server/src/routes/interview.routes.js:91-103`) |
| Company dashboard `handleViewAnalysis` | Logs only; no navigation/API | `src/pages/company-dashboard/index.jsx:339-342` | Could open review panel and call `GET /api/interviews/:id/evaluation` (`server/src/routes/interview.routes.js:109-121`) |
| Company dashboard `handleUpdateStatus` | Logs only; no mutation | `src/pages/company-dashboard/index.jsx:344-347` | Could call `PATCH /api/pipeline/:interviewId` (`server/src/routes/pipeline.routes.js:23-37`) or `PATCH /api/applications/:id` (`server/src/routes/application.routes.js:140-163`) |
| Company quick action `Schedule Interview` | Redirects to candidate practice setup | `src/pages/company-dashboard/index.jsx:349-351`, `src/pages/company-dashboard/components/QuickActions.jsx:15-16` | Should route to company invitation/interview scheduling UX and call `POST /api/invitations` (`server/src/routes/invitation.routes.js:16-30`) |
| Company quick action `Create Job Template` | Redirects to candidate practice setup | `src/pages/company-dashboard/index.jsx:353-355`, `src/pages/company-dashboard/components/QuickActions.jsx:24-25` | Should call template endpoints (`server/src/routes/template.routes.js:17-126`) via a company template screen |
| Company quick action `Generate Reports` | No-op fallback or console log | `src/pages/company-dashboard/components/QuickActions.jsx:33`, `src/pages/company-dashboard/index.jsx:357-360` | Should navigate to `/company-analytics` and invoke implemented PDF/CSV exports (`src/pages/company-dashboard/components/CandidateProgressDashboard.jsx:1436-1454`) |
| Hiring metrics `Export Report` | Calls `handleExportReport` which logs only | `src/pages/company-dashboard/components/HiringMetrics.jsx:98-102`, `src/pages/company-dashboard/index.jsx:362-365`, `src/pages/company-dashboard/index.jsx:516` | Should delegate to real exporter in `CandidateProgressDashboard` |
| Candidate table `Export` button | Rendered without `onClick` handler | `src/pages/company-dashboard/components/CandidateTable.jsx:216-223` | Should call existing analytics export functions (`CandidateProgressDashboard`) |
| Candidate scheduling `Reschedule` button | No handler bound | `src/pages/candidate-dashboard/components/SchedulingWidget.jsx:172-180` | Should call schedule/reschedule API (currently missing from interview routes) |
| Candidate scheduling `View Calendar` button | No handler bound | `src/pages/candidate-dashboard/components/SchedulingWidget.jsx:222-230` | Should navigate to implemented scheduling screen/API (currently missing) |
| Live interview `Technical Support` action | Logs only | `src/pages/live-interview-session/index.jsx:353-356` | Could call live chat/admin support routes if intended (`/api/admin/live-chat/register` exists for admins: `server/src/routes/admin.routes.js:295`) |

## 5) Runtime Probing

### 5.1 Runtime readiness summary
- Backend reachable and healthy: `GET /health -> 200` (`docs/_runtime_outputs/systemcap_current_09_health_check.txt`).
- Mandatory start commands in this run reported port collisions (`docs/_runtime_outputs/systemcap_current_07_npm_start_root.txt`, `docs/_runtime_outputs/systemcap_current_08_npm_run_dev_server.txt`).
- Ports were already listening on 3000 and 4028 during probes (`docs/_runtime_outputs/systemcap_current_port_3000.txt`, `docs/_runtime_outputs/systemcap_current_port_4028.txt`).
- Direct probe to frontend root returned `404`, so browser UI availability is NOT VERIFIED from terminal-only probing (`docs/_runtime_outputs/frontend_root_probe.txt`).

### 5.2 Accounts and role availability used for probes
- Candidate/company admin/system admin identities were discoverable.
- Recruiter and reviewer identities were `null`.
- Evidence: `docs/_runtime_outputs/runtime_user_role_discovery.json`

### 5.3 Candidate practice probe (API-level, authenticated token mint)

| Step | UI route | API call(s) and status | DB write/read impact | Evidence |
|---|---|---|---|---|
| Mint candidate auth + verify profile | `/login` (route exists, UI login not executed in this probe) | `GET /api/auth/me -> 200` | Reads `users` and organization context | `docs/_runtime_outputs/runtime_authenticated_flow_probe.json`, `src/Routes.jsx:143`, `server/src/routes/auth.routes.js:114` |
| Create practice interview | `/practice-interview-setup` | `POST /api/interviews/create -> 201` (`interviewId=8otd1r4OlRBuVbGw00Pt`) | Creates `interviews/{id}` | `docs/_runtime_outputs/runtime_authenticated_flow_probe.json`, `server/src/controllers/interview.controller.js:275-293`, `server/src/services/firebaseData.service.js:397-433` |
| Record consent | `/live-interview-session` | `PATCH /api/interviews/:id/recording-consent -> 200` | Updates `recordingConsentGivenAt`, `recordingConsentVersion` in `interviews/{id}` | `docs/_runtime_outputs/runtime_authenticated_flow_probe.json`, `server/src/controllers/interview.controller.js:358-361` |
| Start interview | `/live-interview-session` | `POST /api/interviews/:id/start -> 500` | No question generation persisted due LLM failure | `docs/_runtime_outputs/runtime_authenticated_flow_probe.json`, `docs/_runtime_outputs/runtime_backend_dev_stdout.txt` |
| End interview | `/live-interview-session` | `POST /api/interviews/:id/end -> 500` | No final evaluation persisted due LLM failure | `docs/_runtime_outputs/runtime_authenticated_flow_probe.json`, `docs/_runtime_outputs/runtime_backend_dev_stdout.txt` |
| Candidate interview list | `/candidate-dashboard` | `GET /api/interviews/user/my-interviews -> 200` | Reads `interviews` filtered by candidate | `docs/_runtime_outputs/runtime_authenticated_flow_probe.json`, `server/src/services/firebaseData.service.js:508-520` |
| Candidate dashboard metrics | `/candidate-dashboard` | `GET /api/analytics/candidate/dashboard-metrics -> 200` | Reads interview analytics aggregates | `docs/_runtime_outputs/runtime_authenticated_flow_probe.json`, `server/src/routes/analytics.routes.js:24` |

Runtime error observed:
```text
Ollama API call failed: fetch failed (ECONNREFUSED)
at server/src/services/llm.service.js:74
at server/src/controllers/interview.controller.js:401
at server/src/controllers/interview.controller.js:457
```
Source: `docs/_runtime_outputs/runtime_backend_dev_stdout.txt`

### 5.4 Hiring workflow probe (API-level, authenticated token mint)

| Step | UI route | API call(s) and status | DB write/read impact | Evidence |
|---|---|---|---|---|
| Company creates job | `/company-jobs` | `POST /api/jobs -> 201` (`jobId=tSM2kdGuMLuqnr5Tugpy`) | Creates `jobs/{id}`, writes activity log | `docs/_runtime_outputs/runtime_authenticated_flow_probe.json`, `server/src/controllers/job.controller.js:197-227`, `server/src/services/firebaseData.service.js:21`, `server/src/services/firebaseData.service.js:24` |
| Company lists jobs | `/company-jobs` | `GET /api/jobs -> 200` | Reads `jobs` | `docs/_runtime_outputs/runtime_authenticated_flow_probe.json`, `server/src/controllers/job.controller.js:326-329` |
| Candidate applies to job | `/jobs/:id` | `POST /api/jobs/:jobId/apply -> 201` (`applicationId=ZytO7hQF1foWjug5LZqR`) | Creates `jobApplications/{id}` status `SUBMITTED` | `docs/_runtime_outputs/runtime_authenticated_flow_probe.json`, `server/src/controllers/application.controller.js:202-223`, `server/src/services/firebaseData.service.js:25` |
| Company reviews applications | `/company-dashboard` applications tab | `GET /api/organizations/applications -> 200` | Reads `jobApplications` by org | `docs/_runtime_outputs/runtime_authenticated_flow_probe.json`, `server/src/routes/application.routes.js:95-108` |
| Company updates status | `/company-dashboard` | `PATCH /api/applications/:id -> 200` (`INTERVIEWING`) | Updates `jobApplications/{id}.status` + history | `docs/_runtime_outputs/runtime_authenticated_flow_probe.json`, `server/src/controllers/application.controller.js:513-539` |
| Company sends invitation | `/company-dashboard` invitation manager | `POST /api/invitations -> 201` (`invitationId=33ff6870-3f6b-4a0a-8b87-6709948cd164`) | Creates `invitations/{id}` | `docs/_runtime_outputs/runtime_authenticated_flow_probe.json`, `server/src/controllers/invitation.controller.js:71-75`, `server/src/services/firebaseData.service.js:22` |
| Candidate accepts invitation | `/invite` | NOT VERIFIED in probe (`hasToken=false` in probe output) | Would create/update `jobApplications` and create `interviews` per acceptance path | `docs/_runtime_outputs/runtime_authenticated_flow_probe.json`, acceptance implementation exists: `server/src/controllers/invitation.controller.js:268-360` |
| Reviewer submits review/override | `/company-dashboard` reviews | NOT VERIFIED (reviewer account unavailable in runtime data) | Would write `interviewReviews` and optional `interviews.finalOverallScore` | `docs/_runtime_outputs/runtime_user_role_discovery.json`, `server/src/controllers/review.controller.js:132-146` |
| Analytics checks | `/company-analytics`, `/system-admin-dashboard` | Company metrics/dashboard metrics and admin fairness/retention summary all `200` | Reads interviews/reviews/settings aggregates | `docs/_runtime_outputs/runtime_authenticated_flow_probe.json`, `server/src/controllers/admin.controller.js:1701-1792`, `server/src/controllers/admin.controller.js:2137-2177` |

### 5.5 Runtime blockers and how to unblock
- Blocker: Ollama unavailable caused interview start/end failures.
- Evidence: `docs/_runtime_outputs/runtime_backend_dev_stdout.txt` (`ECONNREFUSED` at `server/src/services/llm.service.js:74`).
- Unblock: run local Ollama service on configured URL/model (`server/.env.example:60-61`, `server/src/services/llm.service.js:19-21`).

- Blocker: reviewer/recruiter runtime accounts absent.
- Evidence: `docs/_runtime_outputs/runtime_user_role_discovery.json` (`"reviewer": null`, `"recruiter": null`).
- Unblock: create `organizationMembers` entries with roles `REVIEWER`/`RECRUITER` (`server/src/services/firebaseData.service.js:19`, `server/src/middleware/inputValidation.middleware.js:112`).

- Blocker: invitation acceptance not exercised in this probe because token not returned in probe result (`hasToken:false`).
- Evidence: `docs/_runtime_outputs/runtime_authenticated_flow_probe.json`.
- Unblock: use invitation token from invitation delivery path and call `/api/invitations/accept` (`server/src/routes/invitation.routes.js:42-50`).

## 6) Gap Closure List (Top 10, Ranked)

| Rank | Severity | Gap | Evidence | Minimal fix approach |
|---|---|---|---|---|
| 1 | Critical | Backend tests are not green | `docs/_runtime_outputs/systemcap_current_06_npm_test_server.txt`, `server/src/__tests__/atsLifecycle.integration.test.js:388-404`, `server/src/controllers/interview.controller.js:2-12` | Add `systemSettingsStore` mock in `atsLifecycle.integration.test.js` with expected methods (`get` at minimum). |
| 2 | Critical | Interview scheduling model/API missing despite UI fields | `server/src/routes/interview.routes.js:45-229`, `server/src/middleware/inputValidation.middleware.js:762-767`, `src/pages/candidate-dashboard/components/SchedulingWidget.jsx:27`, `src/pages/candidate-dashboard/components/SchedulingWidget.jsx:57` | Add `scheduledFor/timezone/meetingLink` fields in interview schema + CRUD endpoints (`schedule/reschedule/cancel`) and wire UI buttons. |
| 3 | High | Full-session recording is not durably persisted | `server/src/services/firebaseData.service.js:400-428`, `server/src/middleware/upload.middleware.js:31-38`, `src/pages/company-dashboard/components/InterviewReviewEnhanced.jsx:622-639` | Add interview recording upload flow (object storage path + DB field `recordingUrl`) and retrieval/authorization endpoint. |
| 4 | High | Practice start/end path hard-depends on local Ollama without graceful fallback | `docs/_runtime_outputs/runtime_backend_dev_stdout.txt`, `server/src/services/llm.service.js:74-95`, `server/src/controllers/interview.controller.js:401`, `server/src/controllers/interview.controller.js:457` | Add fallback behavior when LLM unavailable (default question pack + deferred scoring queue) and explicit error code/UI guidance. |
| 5 | High | Status taxonomy mismatch between application and pipeline causes inconsistent UX/data | `server/src/middleware/inputValidation.middleware.js:125`, `server/src/middleware/inputValidation.middleware.js:129`, `src/pages/company-dashboard/components/CandidatePipeline.jsx:15-16`, `server/src/utils/applicationLifecycle.util.js:58-61` | Implement a centralized mapping utility and enforce translation at API serialization + UI filters. |
| 6 | Medium | Multiple dashboard actions are placeholders/no-op | `src/pages/company-dashboard/index.jsx:334-365`, `src/pages/company-dashboard/components/QuickActions.jsx:33`, `src/pages/company-dashboard/components/CandidateTable.jsx:216-223`, `src/pages/candidate-dashboard/components/SchedulingWidget.jsx:172-180` | Wire actions to existing APIs/routes (`interviews`, `pipeline`, `invitations`, `analytics export`) and remove placeholder logs. |
| 7 | Medium | Self-service data deletion/export controls are incomplete for end users | `server/src/routes/auth.routes.js:110-220`, `server/src/routes/application.routes.js:67-75`, `server/src/routes/admin.routes.js:358-365` | Add authenticated candidate/company delete/export endpoints with audit logs and retention policy integration. |
| 8 | Medium | Structured LLM output has no schema validator (parse-only) | `server/src/services/llm.service.js:102-110`, `server/src/services/llm.service.js:232-312` | Add response schema validation (AJV/Zod) before persistence; reject or auto-repair malformed payloads. |
| 9 | Medium | Reviewer flow not runtime-verifiable with available seeded data | `docs/_runtime_outputs/runtime_user_role_discovery.json` | Seed recruiter/reviewer fixtures and add deterministic integration tests for review/override paths (`server/src/controllers/review.controller.js:132-146`). |
| 10 | Medium | Reproducible local deployment missing containerization | `docs/_runtime_outputs/systemcap_docker_presence.txt`, `docs/_runtime_outputs/docker_files_list.txt` | Add `Dockerfile`(frontend/backend) + `docker-compose.yml` with env templates and healthchecks. |

## Explicit NOT VERIFIED Items
- Full browser UI journey from login forms through complete candidate/company/reviewer/admin flows: NOT VERIFIED in this audit run.
- Candidate invitation acceptance via real token from email/UI: NOT VERIFIED.
- Durable interview full-session audio/video archive retrieval: NOT VERIFIED (no persisted evidence path found in backend code).
- Any recruiter/reviewer runtime session using separate credentials: NOT VERIFIED.
