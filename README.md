# InterviewAI Pro

InterviewAI Pro is a full-stack interview platform that combines practice interviews, hiring interviews, scheduling, reviewer workflows, and AI-assisted evaluation. The repository contains a React/Vite frontend and an Express/Firebase backend.

## Repository status

Current local verification command:

```bash
npm run verify
```

This runs:
- frontend tests
- backend tests
- production frontend build

## Documentation map

- Architecture: [docs/architecture.md](docs/architecture.md)
- Testing and verification: [docs/testing.md](docs/testing.md)
- Deployment: [docs/deployment.md](docs/deployment.md)
- Evaluator walkthrough: [docs/evaluator-guide.md](docs/evaluator-guide.md)

## Tech stack

- Frontend: React 18, Vite 5, Tailwind CSS, Redux Toolkit
- Backend: Express, Firebase Admin, Socket.IO, Winston
- Optional AI services: Ollama, local Whisper, MediaPipe

## Project structure

```text
.
|-- src/                      # Frontend application
|-- server/                   # Backend API
|-- public/                   # Static frontend assets
|-- docs/                     # Architecture, deployment, testing, evaluator docs
|-- .github/workflows/        # CI and frontend deployment workflows
|-- render.yaml               # Baseline backend deployment blueprint
|-- vite.config.mjs
`-- README.md
```

## Prerequisites

- Node.js 20+
- npm 9+
- Firebase project credentials
- Optional:
  - Ollama for local LLM-backed features
  - Python 3.10+ for `server/whisper_server.py`

## Installation

```bash
git clone https://github.com/Akiyoshi02/InterviewAI-Pro.git
cd InterviewAI-Pro
npm install
npm --prefix server install
```

## Environment configuration

### Frontend

Create a root `.env` file:

```bash
VITE_API_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_OLLAMA_URL=http://localhost:11434
VITE_OLLAMA_MODEL=qwen3:8b
VITE_OLLAMA_FALLBACK_MODEL=qwen2.5:7b-instruct
# Optional: override frontend asset base when deploying under a subpath
# VITE_BASE_PATH=/InterviewAI-Pro/
```

### Backend

Copy:

```bash
cp server/.env.example server/.env
```

Then fill in the required values in `server/.env`.

Reference:
- [server/.env.example](server/.env.example)

## Local development

### Terminal 1: backend

```bash
npm run dev:backend
```

### Terminal 2: frontend

```bash
npm run dev
```

Default local URLs:
- frontend: `http://localhost:4028`
- backend: `http://localhost:3000`

Optional local services:
- Ollama: `ollama run qwen3:8b --keepalive 1h`
- Whisper: `python server/whisper_server.py`

## Available scripts

### Root

| Command | Description |
| --- | --- |
| `npm run dev` | Start the frontend dev server |
| `npm run dev:frontend` | Start the frontend dev server |
| `npm run dev:backend` | Start the backend in watch mode |
| `npm run build` | Build the frontend into `build/` |
| `npm run serve` | Preview the built frontend |
| `npm test` | Run frontend Vitest in interactive mode |
| `npm run test:frontend` | Run frontend tests once |
| `npm run test:backend` | Run backend tests once |
| `npm run verify` | Run frontend tests, backend tests, and frontend build |

### Backend

| Command | Description |
| --- | --- |
| `npm --prefix server run dev` | Start backend with Nodemon |
| `npm --prefix server start` | Start backend in normal mode |
| `npm --prefix server test -- --runInBand` | Run backend Jest suite |

## Health checks

Useful local endpoints:
- `http://localhost:3000/health`
- `http://localhost:3000/api/health`
- `http://localhost:3000/api/ai/health`

## Deployment

### Frontend

Frontend deployment is automated through:
- [.github/workflows/deploy.yml](.github/workflows/deploy.yml)

It publishes the `build/` directory to GitHub Pages.

Frontend asset base behavior:
- local and preview builds default to `/`
- GitHub Actions Pages builds automatically use the repository subpath
- manual overrides can be supplied through `VITE_BASE_PATH`

### Backend

Backend deployment is separate from the frontend.

Baseline backend blueprint:
- [render.yaml](render.yaml)

Detailed instructions:
- [docs/deployment.md](docs/deployment.md)

Minimum backend host settings:
- root directory: `server`
- install command: `npm ci`
- start command: `npm start`
- health check path: `/health`

## Submission and evaluation guidance

If this repository is being assessed as a project submission, use:
- [docs/evaluator-guide.md](docs/evaluator-guide.md)
- [docs/testing.md](docs/testing.md)

These documents define the expected verification path and runtime assumptions.

## Support

If you hit a runtime issue, collect:
- failing command
- console or server log output
- current role and page
- whether backend and optional AI services were running
