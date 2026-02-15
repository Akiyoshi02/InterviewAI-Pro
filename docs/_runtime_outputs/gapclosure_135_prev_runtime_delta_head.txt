# 1. Audit metadata
- Audit date/time: `2026-02-14T23:55:37.8674913+05:30` (terminal output: `docs/_runtime_outputs/09_audit_datetime.txt`)
- Auditor: `Codex (GPT-5)`
- Repo branch/commit hash: `main` / `f716391636586345c331103d83fcd7cdaae2ee67` (terminal output: `docs/_runtime_outputs/01_git_rev_parse_head.txt`)
- Environment:
  - OS: Microsoft Windows 11 Home `10.0.26200` (terminal output: `docs/_runtime_outputs/09_os_version.txt`)
  - Node.js: `v24.11.0` (terminal output: `docs/_runtime_outputs/09_node_version.txt`)
  - npm: `11.6.1` (terminal output: `docs/_runtime_outputs/09_npm_version.txt`)
  - Python: `3.13.9` (terminal output: `docs/_runtime_outputs/09_python_version.txt`)
  - PowerShell: `5.1.26100.7705` (terminal output: `docs/_runtime_outputs/09_powershell_version.txt`)
- Terminal available: `Yes`
- Input docs reviewed for delta:
  - Prior implementation pack uncertainty markers: `docs/IMPLEMENTATION_EVIDENCE_PACK.md:970`, `docs/IMPLEMENTATION_EVIDENCE_PACK.md:1010`, `docs/IMPLEMENTATION_EVIDENCE_PACK.md:1310`, `docs/IMPLEMENTATION_EVIDENCE_PACK.md:1315`
  - ATS MUST delta baseline: `docs/hiring-platform-ats-interview-system-analysis-2026-02-14.md:305-311`

# 2. Runtime readiness checklist (what ran / what failed)
## 2.1 Mandatory command execution results
| Command | Result | Evidence |
|---|---|---|
| `git rev-parse HEAD` | PASS | `docs/_runtime_outputs/01_git_rev_parse_head.txt` |
| `npm install` | PASS | `docs/_runtime_outputs/02_npm_install_root.txt` |
| `npm test -- --run` | PASS (frontend tests) | `docs/_runtime_outputs/03_npm_test_root.txt` |
| `npm run build` | PASS (with chunk/dynamic-import warnings) | `docs/_runtime_outputs/04_npm_run_build_root.txt` |
| `npm install --prefix server` | PASS | `docs/_runtime_outputs/05_npm_install_server.txt` |
| `npm --prefix server test` | FAIL (1 suite) | `docs/_runtime_outputs/06_npm_test_server.txt` |
| `npm start` | PASS (dev server started on `:4028`, long-running command) | `docs/_runtime_outputs/07_npm_start_root.txt` |
| `npm run dev --prefix server` | PASS (backend started on `:3000`, long-running command) | `docs/_runtime_outputs/08_npm_run_dev_server.txt` |

## 2.2 Required output excerpts
### `git rev-parse HEAD`
```text
f716391636586345c331103d83fcd7cdaae2ee67
```
Source: `docs/_runtime_outputs/01_git_rev_parse_head.txt`

### `npm install`
```text
up to date, audited 716 packages in 10s
23 vulnerabilities (2 low, 15 moderate, 4 high, 2 critical)
```
Source: `docs/_runtime_outputs/02_npm_install_root.txt`

### `npm test -- --run`
```text
Test Files  7 passed (7)
Tests       50 passed (50)
Duration    5.48s
```
Source: `docs/_runtime_outputs/03_npm_test_root.txt`

### `npm run build`
```text
vite v5.0.0 building for production...
built in 24.40s
(!) Some chunks are larger than 2000 kB after minification.
```
Source: `docs/_runtime_outputs/04_npm_run_build_root.txt`

### `npm install --prefix server`
```text
up to date, audited 615 packages in 4s
9 vulnerabilities (1 moderate, 8 high)
```
Source: `docs/_runtime_outputs/05_npm_install_server.txt`

### `npm --prefix server test` (failed; full error excerpt)
```text
FAIL src/__tests__/atsLifecycle.integration.test.js
SyntaxError: The requested module '../services/firebaseData.service.js' does not provide an export named 'systemSettingsStore'
...
at src/__tests__/atsLifecycle.integration.test.js:428:33
Test Suites: 1 failed, 5 passed, 6 total
```
Source: `docs/_runtime_outputs/06_npm_test_server.txt`

### `npm start`
```text
VITE v5.0.0 ready
Local:   http://localhost:4028/
```
Source: `docs/_runtime_outputs/07_npm_start_root.txt`

### `npm run dev --prefix server`
```text
[nodemon] starting `node src/server.js`
Firebase Admin initialized successfully
Server running on port 3000
```
Source: `docs/_runtime_outputs/08_npm_run_dev_server.txt`

## 2.3 Runtime probe readiness (executed)
- Public endpoints reachable:
  - `GET /health` -> `200` (`docs/_runtime_outputs/14_runtime_endpoint_probes.txt`)
  - `GET /api/public/config` -> `200` (`docs/_runtime_outputs/14_runtime_endpoint_probes.txt`)
  - `GET /api/public/jobs` -> `200` with live job payload (`docs/_runtime_outputs/14_runtime_endpoint_probes.txt`)
  - `GET /api/public/maintenance-status` -> `200` (`docs/_runtime_outputs/14_runtime_endpoint_probes.txt`)
- Auth gate confirmed:
  - `GET /api/interviews/user/my-interviews` without token -> `401` (`docs/_runtime_outputs/14_runtime_endpoint_probes.txt`)
  - `GET /api/jobs` without token -> `401` (`docs/_runtime_outputs/14_runtime_endpoint_probes.txt`)
  - `GET /api/pipeline` without token -> `401` (`docs/_runtime_outputs/14_runtime_endpoint_probes.txt`)
- Auth/register probes with valid JSON:
  - `POST /api/auth/check-email` -> `200` (`{"success":true,"exists":false,"accountType":null}`) (`docs/_runtime_outputs/18_runtime_auth_probes_valid_json.txt`)
  - `POST /api/auth/register` -> `401` (no Firebase bearer token) (`docs/_runtime_outputs/18_runtime_auth_probes_valid_json.txt`)
- Admin bootstrap probe:
  - `POST /api/admin/auth/bootstrap-admin` without setup token -> `403 INVALID_SETUP_TOKEN`
  - Repeated bootstrap attempts -> `429 RATE_LIMIT_EXCEEDED`
  (`docs/_runtime_outputs/27_runtime_bootstrap_probe_valid_json.txt`)

## 2.4 Why full role-based runtime flows could not be completed
- Candidate/company/reviewer/system-admin end-to-end runtime was blocked by authentication/setup prerequisites:
  - Protected APIs require Bearer token: `server/src/middleware/auth.middleware.js:18-24`
  - Registration endpoint requires Firebase token middleware before controller: `server/src/routes/auth.routes.js:45-53`
  - Candidate registration requires resume/profile uploads: `server/src/controllers/auth.controller.js:353-363`
  - Company registration requires company proof/logo + additional required fields: `server/src/controllers/auth.controller.js:396-432`
  - Admin bootstrap requires `x-admin-setup-token`: `server/src/routes/admin.routes.js:39-56`

# 3. Verified feature table
| Feature | Verified (Yes/No/Partial) | Evidence | Notes |
|---|---|---|---|
| Durable full-session audio/video recording storage | No | No `recordingUrl` persistence path found in backend; only UI read fallback: `src/pages/company-dashboard/components/InterviewReviewEnhanced.jsx:622-639`. Upload/storage paths are limited to profile/resume/company/job advert media: `server/src/middleware/upload.middleware.js:31-38`, `server/src/middleware/upload.middleware.js:52-68`; signed path whitelist also excludes interview recording paths: `server/src/services/localObjectStorage.service.js:31-43`. | UNKNOWN for any external recorder not present in repo. Evidence indicates missing durable full-session storage implementation. |
| What interview answer data is persisted | Yes | Answer write includes text + optional audio URL: `server/src/controllers/interview.controller.js:607-633`; question write model includes `answer`, `answerAudioUrl`, `feedback`: `server/src/services/firebaseData.service.js:479-500`, `server/src/services/firebaseData.service.js:645-656`. Interview root payload includes `transcript` field: `server/src/services/firebaseData.service.js:422`. | Persisted granularity appears per question, not full-session media. |
| Scheduling source of truth (`scheduledFor`, timezone, meeting link) in interview model/API | No | Interview create allowed fields exclude `scheduledFor/timezone/meetingLink`: `server/src/middleware/inputValidation.middleware.js:762-767`. Create payload stores no schedule fields: `server/src/controllers/interview.controller.js:275-293`; store payload has no such fields: `server/src/services/firebaseData.service.js:400-428`. | Scheduling fields appear in UI reads but no authoritative write path found. |
| UI to schedule/reschedule/cancel interviews | Partial | Scheduling widget reads `scheduledFor/meetingLink`: `src/pages/candidate-dashboard/components/SchedulingWidget.jsx:27`, `src/pages/candidate-dashboard/components/SchedulingWidget.jsx:57`; `Reschedule` button has no handler: `src/pages/candidate-dashboard/components/SchedulingWidget.jsx:172-180`; "Schedule" toggles local form only: `src/pages/candidate-dashboard/components/SchedulingWidget.jsx:103-107`. | UI elements exist; API wiring for schedule actions is not implemented. |
| Scheduling APIs (`schedule`, `reschedule`, `cancel`, `no-show`) | No | Interview router has create/get/start/end/answer/recording-consent only: `server/src/routes/interview.routes.js:45-229`; no schedule action routes. | ATS MUST requirement not met (`docs/hiring-platform-ats-interview-system-analysis-2026-02-14.md:307`). |
| Interview status `PENDING` usage and rationale | Partial | Interview status enum does not include `PENDING`: `server/src/middleware/inputValidation.middleware.js:128`. Candidate scheduling widget filters interview list by `SCHEDULED` or `PENDING`: `src/pages/candidate-dashboard/components/SchedulingWidget.jsx:16-19`. Invitation statuses are `PENDING/ACCEPTED/...`: `server/src/services/firebaseData.service.js:35`, `server/src/services/firebaseData.service.js:2360`. | `PENDING` is valid for invitations/org approval, but appears misapplied in interview UI filter. |
| Stage taxonomy mismatch (`INTERVIEWING/SHORTLISTED` vs `INTERVIEW/FINAL`) | Yes (mismatch confirmed) | Application status enum: `server/src/middleware/inputValidation.middleware.js:125`; pipeline enum: `server/src/middleware/inputValidation.middleware.js:129`; pipeline UI columns: `src/pages/company-dashboard/components/CandidatePipeline.jsx:13-19`; application lifecycle transitions use `INTERVIEWING/SHORTLISTED`: `server/src/utils/applicationLifecycle.util.js:44-64`; application manager status options include `INTERVIEWING/SHORTLISTED`: `src/pages/company-dashboard/components/ApplicationsManager.jsx:1020`. | Minimal reconciliation mapping (existing enums only): `SUBMITTED->SCREENING`, `SCREENING->SCREENING`, `INTERVIEWING->INTERVIEW`, `SHORTLISTED->FINAL`, `HIRED->HIRED`, `REJECTED->REJECTED`. |
| Quick actions placeholders | Yes (placeholders confirmed) | Schedule/Create Template quick actions route to practice setup: `src/pages/company-dashboard/index.jsx:349-355`; Generate Report logs only: `src/pages/company-dashboard/index.jsx:357-360`; quick action fallback is no-op for report: `src/pages/company-dashboard/components/QuickActions.jsx:33`. | Placeholders exist in production UI path. |
| Self-service data deletion/export controls for candidates/companies | Partial | Candidate can withdraw application (soft status change): `server/src/routes/application.routes.js:67-75`, `server/src/controllers/application.controller.js:642-669`. No account delete route found in auth routes (`server/src/routes/auth.routes.js` scan) and no `/api/auth/me` delete endpoint present. Admin retention cleanup exists: `server/src/routes/admin.routes.js:358-364`, `server/src/controllers/admin.controller.js:2184-2303`. | User-level delete is not implemented beyond application withdrawal. Company analytics export exists in dashboard UI (`src/pages/company-dashboard/components/CandidateProgressDashboard.jsx:169-176`, `src/pages/company-dashboard/components/CandidateProgressDashboard.jsx:849-910`). |
| Candidate flow runtime (register/login -> practice -> live -> answer -> end -> dashboard) | Partial | Runtime: `check-email` works (`200`) and `register` blocked (`401`): `docs/_runtime_outputs/18_runtime_auth_probes_valid_json.txt`; protected endpoints return `401`: `docs/_runtime_outputs/14_runtime_endpoint_probes.txt`. Code path exists for practice create: `src/pages/practice-interview-setup/index.jsx:135-153`; live answer submit API: `src/services/apiClient.js:614-621`; backend answer persistence: `server/src/controllers/interview.controller.js:604-654`; dashboard data fetch: `src/pages/candidate-dashboard/index.jsx:101-113`. | End-to-end runtime not verified due missing authenticated test user tokens. |
| Company flow runtime (create/publish job -> apply -> review -> invite -> accept -> interview -> review override -> export) | Partial | Public jobs endpoint verified (`200` with live job): `docs/_runtime_outputs/14_runtime_endpoint_probes.txt`. Code paths exist for create/publish: `server/src/routes/job.routes.js:78-87`, `src/pages/company-jobs/index.jsx:1295-1303`; candidate apply: `server/src/routes/application.routes.js:21-39`, `src/pages/jobs/components/JobApplicationForm.jsx:154`; invitation send/accept: `server/src/routes/invitation.routes.js:16-50`, `src/pages/company-dashboard/components/InvitationManager.jsx:238-247`, `src/pages/invite/index.jsx:69-74`; invitation acceptance creates interview: `server/src/controllers/invitation.controller.js:339-355`; reviewer override API + UI: `server/src/controllers/review.controller.js:141-145`, `src/pages/company-dashboard/components/InterviewReviewEnhanced.jsx:933-944`; export: `src/pages/company-dashboard/components/CandidateProgressDashboard.jsx:169-176`, `src/pages/company-dashboard/components/CandidateProgressDashboard.jsx:849-910`. | Full runtime sequence not verified due auth/setup blockers. |

## 3.1 Candidate flow execution log (attempted runtime + code-backed path)
| Step | UI route | API calls | DB reads/writes (from code) | Runtime result | Runtime errors/logs |
|---|---|---|---|---|---|
| 1. Register/Login | `/register`, `/login` (`src/Routes.jsx:143`, `src/Routes.jsx:153`) | `POST /api/auth/check-email`, `POST /api/auth/register` (`server/src/routes/auth.routes.js:62-68`, `server/src/routes/auth.routes.js:45-53`) | Registration writes `users` and optionally `organizations` (`server/src/controllers/auth.controller.js:549-617`) | Partial: email check verified, register blocked | `check-email` -> `200`; `register` -> `401` without bearer token (`docs/_runtime_outputs/18_runtime_auth_probes_valid_json.txt`) |
| 2. Practice interview setup | `/practice-interview-setup` (`src/Routes.jsx:146-151`) | `POST /api/interviews/create` with `mode=PRACTICE` (`src/pages/practice-interview-setup/index.jsx:135-153`) | Interview document create in `interviews` + question subcollection later (`server/src/controllers/interview.controller.js:275-293`, `server/src/services/firebaseData.service.js:398-433`, `server/src/services/firebaseData.service.js:471-505`) | NOT VERIFIED (runtime) | Protected API requires token (`server/src/middleware/auth.middleware.js:18-24`) |
| 3. Live interview session start | `/live-interview-session` (`src/Routes.jsx:64-69`) | `PATCH /api/interviews/:id/recording-consent`, `POST /api/interviews/:id/start` (`src/services/apiClient.js:553-571`) | Interview `recordingConsent*`, `status`, `startedAt`, generated questions (`server/src/controllers/interview.controller.js:358-361`, `server/src/controllers/interview.controller.js:407-414`) | NOT VERIFIED (runtime) | No authenticated test candidate available |
| 4. Submit answer | `/live-interview-session` | `POST /api/interviews/:id/question/answer` (`src/services/apiClient.js:614-621`) | Question subdoc write: `answer`, `answerAudioUrl`, `feedback`, `score` (`server/src/controllers/interview.controller.js:627-651`, `server/src/services/firebaseData.service.js:645-656`) | NOT VERIFIED (runtime) | No authenticated interview session |
| 5. End interview | `/live-interview-session` | `POST /api/interviews/:id/end` (`src/services/apiClient.js:573-579`) | Interview update: `status=COMPLETED`, `evaluation`, `overallScore` (`server/src/controllers/interview.controller.js:463-469`) | NOT VERIFIED (runtime) | No authenticated interview session |
| 6. Candidate dashboard results | `/candidate-dashboard` (`src/Routes.jsx:157-163`) | `GET /api/interviews/user/my-interviews`, `GET /api/analytics/dashboard`, `GET /api/analytics/candidate/dashboard-metrics` (`src/pages/candidate-dashboard/index.jsx:106-110`) | Reads `interviews` and analytics aggregates | Not verified end-to-end | `GET /api/interviews/user/my-interviews` without token -> `401` (`docs/_runtime_outputs/14_runtime_endpoint_probes.txt`) |

## 3.2 Company flow execution log (attempted runtime + code-backed path)
| Step | UI route | API calls | DB reads/writes (from code) | Runtime result | Runtime errors/logs |
|---|---|---|---|---|---|
| 1. Company creates job | `/company-jobs` (`src/Routes.jsx:88-94`) | `POST /api/jobs` (`server/src/routes/job.routes.js:78-87`) | Writes `jobs` + activity log (`server/src/controllers/job.controller.js:197-227`) | NOT VERIFIED (runtime) | Requires authenticated approved company org (`server/src/routes/job.routes.js:80-84`) |
| 2. Publish job | `/company-jobs` | `PATCH /api/jobs/:id` with status `PUBLISHED` (`src/pages/company-jobs/index.jsx:1295-1303`) | Updates job status/visibility (`server/src/controllers/job.controller.js:233-277`) | Partial | Existing published jobs verified via public endpoint: `GET /api/public/jobs` -> `200` (`docs/_runtime_outputs/14_runtime_endpoint_probes.txt`) |
| 3. Candidate applies | `/jobs/:id` (`src/Routes.jsx:203-208`) | `POST /api/jobs/:jobId/apply` (`server/src/routes/application.routes.js:21-39`) | Writes `jobApplications` with `status=SUBMITTED` + snapshots (`server/src/controllers/application.controller.js:202-223`) | NOT VERIFIED (runtime) | Candidate auth required (`server/src/routes/application.routes.js:23-26`) |
| 4. Company reviews application status | `/company-dashboard` / applications panel (`src/Routes.jsx:80-85`, `src/pages/company-dashboard/components/ApplicationsManager.jsx`) | `PATCH /api/applications/:id` (`src/pages/company-dashboard/components/ApplicationsManager.jsx:303`) | Updates application status/disposition (`server/src/routes/application.routes.js:140-163`) | NOT VERIFIED (runtime) | Company auth + role required |
| 5. Company sends invitation | `/company-dashboard` invitation manager | `POST /api/invitations` (`src/pages/company-dashboard/components/InvitationManager.jsx:238-242`) | Writes `invitations` status `PENDING` (`server/src/controllers/invitation.controller.js:71-83`, `server/src/services/firebaseData.service.js:2356-2361`) | NOT VERIFIED (runtime) | Company auth + org role required (`server/src/routes/invitation.routes.js:18-22`) |
| 6. Candidate accepts invitation -> interview created | `/invite?token=...` (`src/pages/invite/index.jsx:18`, `src/pages/invite/index.jsx:69-74`) | `POST /api/invitations/accept` (`server/src/routes/invitation.routes.js:42-50`) | Updates invitation, application -> `INTERVIEWING`, creates interview (`server/src/controllers/invitation.controller.js:269-273`, `server/src/controllers/invitation.controller.js:339-355`) | NOT VERIFIED (runtime) | Candidate auth required (`server/src/routes/invitation.routes.js:44-47`) |
| 7. Reviewer submits review / override | `/company-dashboard?interviewId=...&tab=reviews` | `POST /api/reviews/:interviewId` (`server/src/routes/review.routes.js:36-59`) | Writes `interviewReviews`; optional interview final score override (`server/src/controllers/review.controller.js:132-145`) | NOT VERIFIED (runtime) | Reviewer/admin/recruiter auth required (`server/src/routes/review.routes.js:38-42`) |
| 8. Analytics exports | `/company-analytics` (`src/Routes.jsx:128-133`) | Frontend export actions (PDF/CSV generation) (`src/pages/company-dashboard/components/CandidateProgressDashboard.jsx:169-176`, `src/pages/company-dashboard/components/CandidateProgressDashboard.jsx:849-910`) | Reads analytics data; exports file locally | Code path verified; runtime click-through not verified | No authenticated company session in this audit |

# 4. Delta vs ATS Analysis "MUST" list
| MUST item | Implemented/Partial/Missing | Evidence | Minimal fix recommendation |
|---|---|---|---|
| Explicit interview scheduling APIs/UI (`schedule`, `reschedule`, `cancel`, `no-show`) | Missing | Requirement: `docs/hiring-platform-ats-interview-system-analysis-2026-02-14.md:307`; current interview routes have no schedule operations: `server/src/routes/interview.routes.js:45-229`; model lacks schedule fields in create path: `server/src/middleware/inputValidation.middleware.js:762-767`, `server/src/controllers/interview.controller.js:275-293`. | Add `scheduledFor`, `timezone`, `meetingLink`, `scheduleStatus` to interview schema + storage; add dedicated endpoints; wire candidate/company UI actions to those endpoints. |
| Offer module (model + API + screens + notifications + audit) | Missing | ATS requirement: `docs/hiring-platform-ats-interview-system-analysis-2026-02-14.md:308`. Repo-wide search does not show an offer domain module (`rg -n "offer" server/src src` only returns unrelated text and WebRTC "offer" socket events). | Implement `offers` model and `/api/offers` routes with role gates; add company and candidate screens; emit audit and realtime events using existing activity/audit patterns. |
| Stage taxonomy normalization between application status and pipeline board | Missing | ATS requirement: `docs/hiring-platform-ats-interview-system-analysis-2026-02-14.md:309`; mismatch confirmed by enums and UI (`server/src/middleware/inputValidation.middleware.js:125`, `server/src/middleware/inputValidation.middleware.js:129`, `src/pages/company-dashboard/components/CandidatePipeline.jsx:13-19`, `server/src/utils/applicationLifecycle.util.js:44-64`). | Centralize a single mapping utility and enforce it in API serializers and UI filters; stop direct string divergence in components. |
| Transition guards for interview lifecycle | Partial | ATS requirement: `docs/hiring-platform-ats-interview-system-analysis-2026-02-14.md:310`; there are some guards (`server/src/controllers/interview.controller.js:382-384`, `server/src/controllers/interview.controller.js:614-616`) but no centralized transition matrix. Pipeline move can set status directly among allowed enum values: `server/src/routes/pipeline.routes.js:32-33`, `server/src/controllers/pipeline.controller.js:74-80`. | Introduce interview lifecycle transition utility (similar to `applicationLifecycle.util`) and enforce in `start/end/submit` and pipeline patch endpoints. |
| End-to-end tests for invite idempotency, scheduling branches, no-show, offer revisions, job closure impacts | Partial | ATS requirement: `docs/hiring-platform-ats-interview-system-analysis-2026-02-14.md:311`; tests exist for invite idempotency + job closure (`server/src/__tests__/atsLifecycle.integration.test.js:590`, `server/src/__tests__/atsLifecycle.integration.test.js:480`) but suite currently fails at runtime (`docs/_runtime_outputs/06_npm_test_server.txt`). No schedule/no-show/offer scenario tests found in this file. | Fix failing suite first (missing export in jest mock), then add targeted E2E/integration cases for schedule/no-show/offer branches. |

# 5. Concrete bug list (prioritized)
| Severity | Symptom | Repro steps | Root cause (with file path) | Fix suggestion |
|---|---|---|---|---|
| High | Backend test suite fails (`atsLifecycle.integration.test.js`) | Run `npm --prefix server test` | Jest mock omits `systemSettingsStore` export while `interview.controller` imports it (`server/src/__tests__/atsLifecycle.integration.test.js:388-404`, `server/src/controllers/interview.controller.js:10`, runtime error in `docs/_runtime_outputs/06_npm_test_server.txt`). | Add `systemSettingsStore` mock export in `atsLifecycle.integration.test.js` and keep mock contract aligned with controller imports. |
| High | Interview scheduling is not implementable end-to-end | Check interview API surface and schema | No schedule actions in interview routes; no persisted scheduling fields in create/store path (`server/src/routes/interview.routes.js:45-229`, `server/src/middleware/inputValidation.middleware.js:762-767`, `server/src/controllers/interview.controller.js:275-293`, `server/src/services/firebaseData.service.js:400-428`). | Implement dedicated scheduling fields + endpoints; add validation and transition rules; wire existing UI controls. |
| High | Pipeline/application stages are inconsistent across APIs/UI | Compare enums and UI columns | Application uses `INTERVIEWING/SHORTLISTED`; pipeline uses `INTERVIEW/FINAL` (`server/src/middleware/inputValidation.middleware.js:125`, `server/src/middleware/inputValidation.middleware.js:129`, `src/pages/company-dashboard/components/CandidatePipeline.jsx:13-19`, `src/pages/company-dashboard/components/ApplicationsManager.jsx:1020`). | Add canonical mapping layer and use it for all list/update payloads and rendering. |
| Medium | Quick actions execute placeholder behavior | Click dashboard quick actions | Schedule/Create Template redirect to practice setup; Generate Report only logs (`src/pages/company-dashboard/index.jsx:349-360`, `src/pages/company-dashboard/components/QuickActions.jsx:15-33`). | Route actions to implemented modules (`/company-invitations`, `/company-interviews`, `/company-analytics`) and call existing APIs/exports. |
| Medium | Interview recording viewer expects `recordingUrl` but backend never writes it | Open interview review video tab after typical flow | UI checks `interview.recordingUrl`; backend stores only per-question `answerAudioUrl` and interview `transcript` (`src/pages/company-dashboard/components/InterviewReviewEnhanced.jsx:622-639`, `server/src/controllers/interview.controller.js:627-633`, `server/src/services/firebaseData.service.js:422`, `server/src/services/firebaseData.service.js:479-500`). | Either implement durable recording upload + `recordingUrl` persistence, or remove/replace viewer with currently available artifacts. |
| Medium | Candidate scheduling widget treats `PENDING` as interview status and exposes non-functional reschedule | Open candidate dashboard scheduling widget | Interview status enum excludes `PENDING` (`server/src/middleware/inputValidation.middleware.js:128`), but UI filters `SCHEDULED/PENDING` and renders `Reschedule` without handler (`src/pages/candidate-dashboard/components/SchedulingWidget.jsx:16-19`, `src/pages/candidate-dashboard/components/SchedulingWidget.jsx:172-180`). | Remove `PENDING` from interview status filter or map from invitation lifecycle explicitly; wire reschedule button to real schedule endpoint once implemented. |
| Medium | No self-service account/profile deletion for candidate/company | Search auth/application/admin routes | Candidate can only withdraw applications (`server/src/routes/application.routes.js:67-75`, `server/src/controllers/application.controller.js:642-669`); deletion/retention is admin-only (`server/src/routes/admin.routes.js:358-364`, `server/src/controllers/admin.controller.js:2184-2303`). | Add authenticated self-service data deletion endpoints with audit logging and retention policy integration. |
| Low | "Export" button in CandidateTable has no click handler | Open company dashboard recent interviews card | Export button rendered without `onClick` (`src/pages/company-dashboard/components/CandidateTable.jsx:216-223`). | Connect button to existing export utility used by `CandidateProgressDashboard` or remove until implemented. |

# 6. "What to demo" script
## 10-15 minute demo script using verified paths only
1. Show runtime environment + commit.
   - Run/quote `git rev-parse HEAD`, OS/Node/Python outputs.
   - Evidence: `docs/_runtime_outputs/01_git_rev_parse_head.txt`, `docs/_runtime_outputs/09_*`.
2. Show build/test readiness.
   - Frontend tests pass and build succeeds.
   - Backend tests currently fail (known issue).
   - Evidence: `docs/_runtime_outputs/03_npm_test_root.txt`, `docs/_runtime_outputs/04_npm_run_build_root.txt`, `docs/_runtime_outputs/06_npm_test_server.txt`.
3. Start services.
   - Frontend dev server on `http://localhost:4028`.
   - Backend on `http://localhost:3000`.
   - Evidence: `docs/_runtime_outputs/07_npm_start_root.txt`, `docs/_runtime_outputs/08_npm_run_dev_server.txt`.
4. Demo verified public API surface.
   - `GET /health`
   - `GET /api/public/config`
   - `GET /api/public/jobs`
   - `GET /api/public/maintenance-status`
   - Evidence: `docs/_runtime_outputs/14_runtime_endpoint_probes.txt`.
5. Demo security gates on protected APIs.
   - `GET /api/interviews/user/my-interviews` -> `401`
   - `GET /api/jobs` -> `401`
   - `GET /api/pipeline` -> `401`
   - Evidence: `docs/_runtime_outputs/14_runtime_endpoint_probes.txt`.
6. Demo registration/auth gate behavior.
   - `POST /api/auth/check-email` valid JSON -> `200`.
   - `POST /api/auth/register` without bearer token -> `401`.
   - Evidence: `docs/_runtime_outputs/18_runtime_auth_probes_valid_json.txt`.
7. Demo admin bootstrap guard.
   - `POST /api/admin/auth/bootstrap-admin` without token -> `403 INVALID_SETUP_TOKEN`.
   - Repeated attempts trigger rate limit (`429`).
   - Evidence: `docs/_runtime_outputs/27_runtime_bootstrap_probe_valid_json.txt`.
8. Code-backed delta walkthrough (no unverified claims).
   - Show missing interview scheduling endpoints/fields.
   - Show stage mismatch and proposed minimal mapping.
   - Show recording persistence gap (`recordingUrl` read vs no write path).
   - Evidence: cited in Sections 3-5.

## Explicitly not demoed (blocked/UNKNOWN)
- Full multi-role authenticated journey (candidate/company/reviewer/system-admin) with real session creation, answer submission, review override, and analytics export is **NOT VERIFIED at runtime** in this audit because required Firebase/user bootstrap credentials were unavailable to the terminal session.
