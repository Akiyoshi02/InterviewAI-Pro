# DEMO_RUNBOOK

## 1) Preconditions
1. Start Ollama service (required for live scoring):
```bash
ollama serve
```
2. Confirm model is available:
```bash
curl -i http://localhost:11434/api/tags
```
Expected model evidence example: `qwen2.5:7b-instruct` (`docs/_runtime_outputs/demo_36_ollama_tags_probe.txt`).

## 2) Start App
1. Backend:
```bash
npm run dev --prefix server
```
2. Frontend:
```bash
npm start
```
3. Verify health:
```bash
curl -i http://localhost:3000/health
curl -i http://localhost:3000/api/public/config
curl -i http://localhost:3000/api/ai/health
```
Expected AI health with Ollama ON: `ollamaReachable=true`, `modelReady=true` (`docs/_runtime_outputs/demo_43_ai_health_fresh_server_with_ollama.txt`).

## 3) Seed Demo Accounts/Tokens
```bash
node scripts/demo_seed_and_tokens.mjs
```
Redacted evidence: `docs/_runtime_outputs/demo_seed_redacted.txt`.
Secrets location (local only): `.env.local`.

## 4) 10–15 Minute Live Click Path
1. Company user logs in.
2. Company creates hiring interview for seeded candidate.
3. Company schedules interview (`scheduledFor/timezone/meetingLink`).
4. Candidate logs in and opens live interview session.
5. Candidate starts interview.
6. Candidate answers at least one question.
7. Candidate ends interview.
8. Reviewer opens interview review.
9. Reviewer confirms evaluation shows non-null `overallScore` and `readinessLevel`.
10. Reviewer opens Video tab and plays recording.

Implementation evidence for this path:
- Scheduling backend/UI: `server/src/controllers/interview.controller.js:618`, `src/pages/candidate-dashboard/components/SchedulingWidget.jsx:137`
- Start/end + scoring: `server/src/controllers/interview.controller.js:924`, `server/src/controllers/interview.controller.js:1105`
- Recording upload/retrieval: `server/src/controllers/interview.controller.js:832`, `server/src/controllers/interview.controller.js:884`
- Reviewer playback + metadata: `src/pages/company-dashboard/components/InterviewReviewEnhanced.jsx:687`, `src/pages/company-dashboard/components/InterviewReviewEnhanced.jsx:719`

## 5) Scripted API Journey (for backup demo)
```bash
node scripts/demo_api_journey.mjs
```
Outputs:
- Summary: `docs/_runtime_outputs/demo_api_journey_summary.txt`
- Full requests/responses: `docs/_runtime_outputs/demo_api_journey_requests_and_responses.txt`

## 6) Repeated Trial Probability
```bash
node scripts/demo_trials.mjs --runs 7
```
Outputs:
- `docs/_runtime_outputs/demo_trials_summary.txt`
- `docs/_runtime_outputs/demo_trials_results.json`

## 7) Screenshot Checklist
- Login success screen for Company, Candidate, Reviewer
- Company scheduling action result
- Candidate live interview start state
- Candidate interview end result with score/readiness visible
- Reviewer evaluation tab with score + readiness
- Reviewer video tab with playable recording and metadata panel
