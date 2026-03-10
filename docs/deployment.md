# Deployment Guide

## Current deployment shape

- Frontend: GitHub Pages via `.github/workflows/deploy.yml`
- Backend: separate Node host required

The frontend and backend are intentionally decoupled. The frontend must point to the deployed backend through `VITE_API_URL`.

## Frontend deployment

The repository already includes a GitHub Pages deployment workflow:
- `.github/workflows/deploy.yml`

It:
1. installs frontend dependencies
2. runs `npm run build`
3. publishes the `build/` directory to GitHub Pages

Required frontend environment:

```bash
VITE_API_URL=https://your-backend-host.example.com
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
# Optional when deploying under a manual subpath:
# VITE_BASE_PATH=/InterviewAI-Pro/
```

Asset base behavior:
- local and preview builds default to `/`
- GitHub Actions Pages builds auto-detect the repository name and use that subpath
- if you deploy the frontend under a different non-root path, set `VITE_BASE_PATH` explicitly

## Backend deployment requirements

The backend is a standard Node 20 Express service located in `server/`.

Required deployment characteristics:
- Node.js 20 runtime
- working directory: `server`
- install command: `npm ci`
- start command: `npm start`
- health check path: `/health`

## Backend environment

Use `server/.env.example` as the baseline.

Minimum production variables typically include:
- `PORT`
- `NODE_ENV=production`
- `FRONTEND_URL`
- `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT`
- `FIREBASE_DATABASE_URL`
- `EMAIL_VERIFICATION_CODE_SECRET`
- SMTP settings if email delivery is required

Optional services:
- `OLLAMA_*`
- `WHISPER_SERVER_URL`
- `SIGHTENGINE_*`
- `SENTRY_DSN`

## Example backend host settings

For a managed Node host such as Render, Railway, or Fly.io:

| Setting | Value |
| --- | --- |
| Root directory | `server` |
| Install command | `npm ci` |
| Start command | `npm start` |
| Health check | `/health` |

## Render blueprint

The repository includes a baseline backend blueprint:
- `render.yaml`

This is intended as a starting point, not a secret-bearing production config.

## Post-deploy checks

After backend deployment:

1. Confirm health endpoint responds:

```bash
curl https://your-backend-host.example.com/health
```

2. Confirm frontend is pointing to the correct backend URL.
3. Confirm Firebase credentials and database URL are valid.
4. Confirm CORS allows the deployed frontend origin through `FRONTEND_URL`.

## Local production-style smoke test

You can validate the frontend build locally with:

```bash
npm run build
npm run serve
```

You can validate the backend locally with:

```bash
cd server
npm start
```
