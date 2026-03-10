# Evaluator Guide

## Goal

This guide is for a supervisor, examiner, or reviewer who needs to run the project locally and verify the core workflows without reverse-engineering the repository.

## Prerequisites

- Node.js 20+
- npm 9+
- Firebase project credentials
- Optional:
  - Ollama for local LLM-backed features
  - local Whisper server for speech transcription

## Setup

From the repository root:

```bash
npm install
npm --prefix server install
```

Configure:
- root `.env`
- `server/.env`

Reference files:
- `README.md`
- `server/.env.example`

## Start the stack

Terminal 1:

```bash
npm run dev:backend
```

Terminal 2:

```bash
npm run dev
```

Default URLs:
- frontend: `http://localhost:4028`
- backend: `http://localhost:3000`

## Health checks

Check:
- `http://localhost:3000/health`
- `http://localhost:3000/api/ai/health` if AI services are expected

## Minimum verification path

### 1. Frontend and backend integrity

Run:

```bash
npm run verify
```

This should complete without test failures.

### 2. Candidate flow

Verify:
- registration or sign-in
- dashboard access
- applications list
- interview access rules

### 3. Recruiter flow

Verify:
- company dashboard access
- application status movement
- interview scheduling
- reviewer assignment
- review reminder administration

### 4. Reviewer flow

Verify:
- restricted reviewer navigation
- assigned reviews page
- evidence/review workflow
- no pipeline-control actions

### 5. Company admin flow

Verify:
- organization-facing pages
- member and settings access
- recruiter/reviewer invitation management

## Notes for AI-backed features

If Ollama or Whisper is unavailable:
- the application should still boot
- some scoring, generation, or transcript features may degrade or become pending/unavailable

This is expected and should be noted during evaluation.

## Recommended evidence to capture

For submission/demo purposes, capture:
- `npm run verify` output
- screenshots of each role dashboard
- one recruiter scheduling flow
- one reviewer assigned review flow
- health check response

## Known non-blocking warnings

You may still see:
- React test deprecation warnings
- Vite chunk warnings during build

These are currently non-failing warnings rather than runtime blockers.
