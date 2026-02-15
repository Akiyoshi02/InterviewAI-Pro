# DEMO_EVIDENCE_PACK

## 1) Audit Metadata
- Timestamp: `2026-02-16T00:02:25.9067590+05:30` (`docs/_runtime_outputs/demo_98_timestamp.txt`)
- Branch: `demo/finalization-2026-02-15` (`docs/_runtime_outputs/demo_91_git_status_after_changes.txt`)
- Commit: `6ba42904805ca679dd6d551f9f0ce6a2668c45f5` (`docs/_runtime_outputs/demo_90_git_rev_after_changes.txt`)
- Node: `v24.11.0` (`docs/_runtime_outputs/demo_96_node_version.txt`)
- npm: `11.6.1` (`docs/_runtime_outputs/demo_97_npm_version.txt`)

## 2) Build/Test Evidence
- Root install: `docs/_runtime_outputs/demo_10_npm_install_root.txt`
- Server install: `docs/_runtime_outputs/demo_11_npm_install_server.txt`
- Root tests (`vitest`) pass: `docs/_runtime_outputs/demo_12_npm_test_root_run.txt`
- Server tests (`jest`) pass: `docs/_runtime_outputs/demo_13_npm_test_server.txt`
- Server tests after stability fix pass: `docs/_runtime_outputs/demo_45_npm_test_server_after_questionid_fix.txt`
- Production build pass: `docs/_runtime_outputs/demo_14_npm_build_root.txt`

## 3) Runtime Probe Evidence
- Base health: `docs/_runtime_outputs/demo_33_runtime_probes_fresh.txt`
- Auth gate (`401 No token provided` on protected endpoint): `docs/_runtime_outputs/demo_95_auth_gate_probe.txt`
- Ollama model inventory: `docs/_runtime_outputs/demo_36_ollama_tags_probe.txt`
- AI health with Ollama ON (`ollamaReachable=true`, `modelReady=true`): `docs/_runtime_outputs/demo_43_ai_health_fresh_server_with_ollama.txt`

## 4) Authenticated End-to-End Journey (Token-backed)
- Token seeding: `node scripts/demo_seed_and_tokens.mjs`
- Redacted result: `docs/_runtime_outputs/demo_seed_redacted.txt`
- Full API journey output:
  - Summary: `docs/_runtime_outputs/demo_api_journey_summary.txt`
  - Request/response trace: `docs/_runtime_outputs/demo_api_journey_requests_and_responses.txt`
  - Command log: `docs/_runtime_outputs/demo_47_api_journey_with_ollama_after_fix_command_output.txt`

Verified checkpoints (all PASS):
1. `GET /api/ai/health` reachable and Ollama ready.
2. Company creates interview.
3. Company schedules and reschedules interview.
4. Candidate starts interview.
5. Candidate submits answer.
6. Candidate ends interview.
7. Evaluation is completed with non-null `overallScore/readinessLevel`.
8. Recording upload succeeds and persists `recordingUrl`.
9. Reviewer fetches signed recording URL.
10. Reviewer fetches evaluation payload.

## 5) Trial Runs and Success Probability

### 5.1 Initial Stress Batch (historical failure mode)
- Command: `node scripts/demo_trials.mjs --runs 30`
- Output: `docs/_runtime_outputs/demo_60_trials_command_output.txt`
- Result snapshot: failures dominated by unavailable Ollama and API throttling under heavy repeated calls.

### 5.2 Demo-target Batch (Ollama ON, post-fix)
- Command: `node scripts/demo_trials.mjs --runs 7`
- Output: `docs/_runtime_outputs/demo_49_trials_7_runs_with_ollama_command_output.txt`
- Summary: `docs/_runtime_outputs/demo_trials_summary.txt`
- Result:
  - Runs: `7`
  - Passes: `7`
  - Success rate: `100.00%`
  - Wilson 95% CI: `[64.57%, 100.00%]`

## 6) Code Evidence for Demo-Critical Paths
- AI health endpoint: `server/src/routes/index.js:63`
- Ollama warm-up on boot: `server/src/server.js:92`
- Structured output validation + repair: `server/src/services/llm.service.js:348`, `server/src/services/llm.service.js:448`
- Run evaluation endpoint:
  - Route: `server/src/routes/interview.routes.js:287`
  - Controller: `server/src/controllers/interview.controller.js:1105`
- Scheduling endpoints:
  - `server/src/controllers/interview.controller.js:618`
  - `server/src/controllers/interview.controller.js:686`
  - `server/src/controllers/interview.controller.js:748`
- Recording persistence:
  - Upload handler: `server/src/controllers/interview.controller.js:832`
  - Recording URL retrieval: `server/src/controllers/interview.controller.js:884`
  - DB field mapping: `server/src/services/firebaseData.service.js:429`
- Live capture minimum-size guard: `src/pages/live-interview-session/index.jsx:29`, `src/pages/live-interview-session/index.jsx:446`
- Reviewer playback + metadata panel: `src/pages/company-dashboard/components/InterviewReviewEnhanced.jsx:687`, `src/pages/company-dashboard/components/InterviewReviewEnhanced.jsx:719`
- Stability fix (LLM numeric question IDs): `server/src/services/firebaseData.service.js:486`

## 7) Remaining Out-of-Scope / Not Verified
- UI Playwright end-to-end recording for the full click path: NOT VERIFIED
- Real webcam/microphone captured media playback evidence artifact in this pack: NOT VERIFIED (automated path used sample upload file)
- Whisper positive health path: NOT VERIFIED (`whisperConfigured=false` in `docs/_runtime_outputs/demo_43_ai_health_fresh_server_with_ollama.txt`)
