# UPDATED SYSTEM CAPABILITY REPORT

## 1) Audit Metadata
- Audit date: `2026-02-15`
- Auditor: `Codex (GPT-5)`
- Branch: `gap-closure/2026-02-15`
- Step-0 snapshot commit: `c785c088c6abeae45fe7e7dc59c4dd5ccb2dbe62` (`docs/_runtime_outputs/gapclosure_AUTH_01_git_rev_parse_head.txt`)
- Post-report snapshot commit: see `docs/_runtime_outputs/gapclosure_AUTH_93_git_rev_after_reports.txt` (`docs/_runtime_outputs/gapclosure_AUTH_93_git_rev_after_reports.txt`)
- Working tree contained additional uncommitted audit artifacts/scripts during this run (`docs/_runtime_outputs/gapclosure_AUTH_02_git_status.txt`).

## 2) Runtime Readiness (Commands + Probes)
| Command/Probe | Result | Evidence |
|---|---|---|
| `npm install` | PASS | `docs/_runtime_outputs/gapclosure_AUTH_10_npm_install_root.txt` |
| `npm install --prefix server` | PASS | `docs/_runtime_outputs/gapclosure_AUTH_11_npm_install_server.txt` |
| `npm test -- --run` | PASS | `docs/_runtime_outputs/gapclosure_AUTH_12_npm_test_root_run.txt` |
| `npm --prefix server test` | PASS | `docs/_runtime_outputs/gapclosure_AUTH_13_npm_test_server.txt` |
| `npm run build` | PASS | `docs/_runtime_outputs/gapclosure_AUTH_14_npm_run_build_root.txt` |
| `npm run dev --prefix server` | PASS (startup logs captured) | `docs/_runtime_outputs/gapclosure_AUTH_16_server_dev_start.txt` |
| `npm start` | PASS (startup logs captured) | `docs/_runtime_outputs/gapclosure_AUTH_17_frontend_start.txt` |
| `curl -i http://localhost:3000/health` | PASS (`200`) | `docs/_runtime_outputs/gapclosure_AUTH_18_base_probes.txt` |
| `curl -i http://localhost:3000/api/public/config` | PASS (`200`) | `docs/_runtime_outputs/gapclosure_AUTH_18_base_probes.txt` |
| Protected endpoint auth gate (no token) | PASS (`401`) | `docs/_runtime_outputs/gapclosure_AUTH_51_runtime_base_and_auth_gate_probes.txt` |

## 3) Authenticated Verification Blocker Status
Previous blocker: multi-role authenticated runtime flow was **NOT VERIFIED**.

Current status: **CLEARED (API-level runtime verified)** using token-backed candidate/company/reviewer calls.

### 3.1 Token acquisition (programmatic)
- Method used: Firebase Admin custom token -> Identity Toolkit ID token exchange.
- Implementation script: `scripts/acquire_runtime_tokens.mjs:87`, `scripts/acquire_runtime_tokens.mjs:185`, `scripts/acquire_runtime_tokens.mjs:273`
- Role fixtures provisioned in Firebase Auth + Firestore:
  - Candidate UID: `gapclosure-candidate-runtime`
  - Company UID: `gapclosure-company-runtime`
  - Reviewer UID: `gapclosure-reviewer-runtime`
  - Org ID: `gapclosure-runtime-org`
  - Evidence: `docs/_runtime_outputs/gapclosure_AUTH_40_token_acquisition.txt`, `docs/_runtime_outputs/gapclosure_AUTH_41_token_acquisition_command_output.txt`
- Secret handling:
  - Tokens stored only in untracked `.env.local` (`.gitignore` excludes `.env.local`: `.gitignore:8`)
  - Runtime logs redact bearer tokens (`scripts/authenticated_journey.mjs:33`, `scripts/authenticated_journey.mjs:75`)

## 4) Authenticated End-to-End API Journey (Verified)
Execution script: `scripts/authenticated_journey.mjs`

- Script location and flow steps:
  - Reads base URL + tokens from env: `scripts/authenticated_journey.mjs:18`, `scripts/authenticated_journey.mjs:19`
  - Create interview: `scripts/authenticated_journey.mjs:165`
  - Schedule: `scripts/authenticated_journey.mjs:185`
  - Reschedule: `scripts/authenticated_journey.mjs:196`
  - Start (candidate): `scripts/authenticated_journey.mjs:206`
  - End (candidate): `scripts/authenticated_journey.mjs:236`
  - Upload recording: `scripts/authenticated_journey.mjs:253`
  - Fetch recording URL (reviewer): `scripts/authenticated_journey.mjs:263`
  - Fetch evaluation (reviewer): `scripts/authenticated_journey.mjs:272`
- Summary output: `docs/_runtime_outputs/gapclosure_AUTH_90_authenticated_journey_summary.txt`
- Full request/response trace output: `docs/_runtime_outputs/gapclosure_AUTH_91_authenticated_journey_requests_and_responses.txt`

### 4.1 Verified results
| Verified item | Result | Evidence |
|---|---|---|
| Company creates hiring interview | PASS (`201`) | `docs/_runtime_outputs/gapclosure_AUTH_91_authenticated_journey_requests_and_responses.txt` (STEP 1) |
| Company schedules interview | PASS (`200`) | same file (STEP 2) |
| Company reschedules interview | PASS (`200`) | same file (STEP 3) |
| Candidate starts interview with Ollama unavailable fallback | PASS (`200`, `llmUnavailable=true`) | same file (STEP 4), summary check 4 in `docs/_runtime_outputs/gapclosure_AUTH_90_authenticated_journey_summary.txt` |
| Candidate submits answer | PASS (`200`) | same file (STEP 6) |
| Candidate ends interview without hard fail | PASS (`200`, `pendingEvaluation=true`, `llmUnavailable=true`) | same file (STEP 7), summary check 7 |
| Company uploads recording | PASS (`201`, `recordingUrl` present) | same file (STEP 8), summary check 8 |
| Reviewer fetches recording URL | PASS (`200`) | same file (STEP 9), summary check 9 |
| Reviewer fetches evaluation | PASS (`200`) | same file (STEP 10), summary check 10 |

## 5) Forced Ollama-Unavailable Proof
- Backend was started with invalid Ollama URL to force fallback behavior:
  - Startup process/logs: `docs/_runtime_outputs/gapclosure_AUTH_50_server_dev_ollama_unavailable_stdout.txt`
- Runtime fallback evidence in backend logs:
  - `ECONNREFUSED` against `127.0.0.1:65534`
  - `Ollama unavailable at interview start; fallback question pack applied.`
  - `Ollama unavailable at interview end; evaluation marked pending.`
  - Evidence file: `docs/_runtime_outputs/gapclosure_AUTH_50_server_dev_ollama_unavailable_stdout.txt`
- Corresponding code paths:
  - Start fallback flags: `server/src/controllers/interview.controller.js:853`, `server/src/controllers/interview.controller.js:858`
  - End fallback flags: `server/src/controllers/interview.controller.js:935`, `server/src/controllers/interview.controller.js:954`

## 6) Capability Matrix (Focused Delta)
| Feature | Status | Evidence |
|---|---|---|
| Multi-role authenticated token flow | Implemented + runtime verified | `scripts/acquire_runtime_tokens.mjs:222`, `docs/_runtime_outputs/gapclosure_AUTH_41_token_acquisition_command_output.txt` |
| Interview scheduling API (`schedule`/`reschedule`) | Implemented + runtime verified | `server/src/routes/interview.routes.js:150`, `server/src/routes/interview.routes.js:170`, `docs/_runtime_outputs/gapclosure_AUTH_91_authenticated_journey_requests_and_responses.txt` |
| Durable recording upload + persisted `recordingUrl` | Implemented + runtime verified | `server/src/controllers/interview.controller.js:704`, `server/src/controllers/interview.controller.js:732`, trace STEP 8 |
| Authorized recording retrieval | Implemented + runtime verified | `server/src/routes/interview.routes.js:229`, `server/src/controllers/interview.controller.js:765`, trace STEP 9 |
| Reviewer evaluation retrieval | Implemented + runtime verified | `server/src/routes/interview.routes.js:111`, trace STEP 10 |
| Ollama graceful fallback start/end | Implemented + runtime verified | `server/src/controllers/interview.controller.js:848`, `server/src/controllers/interview.controller.js:926`, server stdout + journey summary |
| Backend tests green | Implemented + runtime verified | `docs/_runtime_outputs/gapclosure_AUTH_13_npm_test_server.txt` |

## 7) Remaining NOT VERIFIED (Narrowed)
- Browser UI click-through for this same flow (manual UI interaction) is **NOT VERIFIED** in this pack; verification is API-level via authenticated scripts.
- Playback integrity of uploaded dummy `session_dummy.webm` content is **NOT VERIFIED** as media quality; storage/retrieval pipeline is verified.

## 8) New Evidence Files Added
- `docs/_runtime_outputs/gapclosure_AUTH_40_token_acquisition.txt`
- `docs/_runtime_outputs/gapclosure_AUTH_41_token_acquisition_command_output.txt`
- `docs/_runtime_outputs/gapclosure_AUTH_50_server_dev_ollama_unavailable_pid.txt`
- `docs/_runtime_outputs/gapclosure_AUTH_50_server_dev_ollama_unavailable_stdout.txt`
- `docs/_runtime_outputs/gapclosure_AUTH_50_server_dev_ollama_unavailable_stderr.txt`
- `docs/_runtime_outputs/gapclosure_AUTH_51_runtime_base_and_auth_gate_probes.txt`
- `docs/_runtime_outputs/gapclosure_AUTH_53_server_shutdown_info.txt`
- `docs/_runtime_outputs/gapclosure_AUTH_90_authenticated_journey_summary.txt`
- `docs/_runtime_outputs/gapclosure_AUTH_91_authenticated_journey_requests_and_responses.txt`
- `docs/_runtime_outputs/gapclosure_AUTH_92_authenticated_journey_command_output.txt`
- `docs/_runtime_outputs/gapclosure_AUTH_93_git_rev_after_reports.txt`
- `docs/_runtime_outputs/gapclosure_AUTH_94_git_show_after_reports.txt`
