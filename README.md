# InterviewAI Pro

InterviewAI Pro is a mock interview platform that combines live practice sessions with automated feedback and progress tracking. The project includes a React/Vite frontend, an Express/Firebase backend, and optional local AI services for transcription and scoring.

---

## Overview

- Separate candidate and company dashboards with role-specific insights
- Live interview experience with question flow, chat, and feedback panels
- AI assistant for follow-up guidance and study plan generation
- Local speech and pose analysis support through Whisper and MediaPipe
- Backend APIs with authentication, validation, rate limiting, and realtime updates

---

## Architecture

| Layer | Responsibilities | Key Technology |
| --- | --- | --- |
| Frontend (`src/`) | Single-page app, dashboards, interview UI, assistant, pose overlays | React 18, Vite, Tailwind CSS, Lucide, MediaPipe |
| Backend (`server/`) | Auth, analytics, interview orchestration, Firebase and Supabase adapters, sockets | Node.js, Express, Firebase Admin, Socket.IO, Winston |
| AI/ML Services | Local inference and transcription | Ollama, Faster-Whisper (Python), MediaPipe |
| Deployment | Static frontend hosting and separate API hosting | GitHub Actions Pages workflow, environment-based API URL |

---

## Tech Stack

- Core: React 18, Vite 5, Tailwind CSS, Redux Toolkit, React Hook Form
- UI and Visualization: Framer Motion, Lucide, Radix Slot, D3, Recharts
- Server: Express 4, Firebase Admin, JWT, CORS, Helmet, Socket.IO, Winston
- AI and Realtime: Ollama, Faster-Whisper server, MediaPipe Tasks Vision
- Tooling: ESLint, npm, GitHub Actions (Pages), Nodemon

---

## Project Structure

```text
.
|-- src/                     # React + Vite application
|   |-- components/          # Shared UI and layout components
|   |-- pages/               # Route-based feature modules
|   |-- services/            # API, LLM, audio, and pose helpers
|   |-- hooks/contexts/      # State and feature hooks
|   `-- styles/              # Tailwind and global CSS
|-- server/                  # Express API and socket server
|   |-- src/                 # Config, controllers, middleware, routes
|   |-- prisma/              # Placeholder for DB schema
|   `-- whisper_server.py    # Optional local Whisper endpoint
|-- public/                  # Static assets and manifest
|-- .github/workflows/       # GitHub Pages deployment pipeline
`-- README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Python 3.10+ (only if you plan to run `whisper_server.py`)
- Ollama installed locally ([documentation](https://ollama.ai))

### 1. Clone and Install

```bash
git clone https://github.com/Akiyoshi02/InterviewAI-Pro.git
cd InterviewAI-Pro
npm install

cd server
npm install
cd ..
```

### 2. Configure Environment Variables

Create a root `.env` file for the Vite app:

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
# Optional: set VITE_LOCAL_WHISPER_URL when using a local Whisper server
```

Copy `server/.env.example` to `server/.env` and fill in required values (Firebase Admin, Sightengine, Ollama, Whisper, and related settings).

### 3. Run Locally

```bash
# Terminal 1: API + sockets
cd server
npm run dev

# Terminal 2: Frontend
cd ..
npm run dev
# Default Vite port: 4028 (set in vite.config.mjs)
```

Optional local services:

- Ollama: `ollama run qwen3:8b --keepalive 1h`
- Whisper: `python server/whisper_server.py`

### Qwen3-8B Configuration

1. Pull required models:
`ollama pull qwen3:8b`
`ollama pull qwen2.5:7b-instruct`
2. Set `VITE_OLLAMA_MODEL` and `OLLAMA_MODEL` to `qwen3:8b`.
3. Set `VITE_OLLAMA_FALLBACK_MODEL` and `OLLAMA_FALLBACK_MODEL` to `qwen2.5:7b-instruct`.
4. The app applies a tuned preset for Qwen3 by default (16K context and related generation settings). Override only if you need custom behavior.

---

## Available Scripts

| Location | Command | Description |
| --- | --- | --- |
| `/` | `npm run dev` | Start the Vite development server |
| `/` | `npm run build` | Build production assets to `build/` |
| `/` | `npm run serve` | Preview the built frontend |
| `/server` | `npm run dev` | Run backend with Nodemon reload |
| `/server` | `npm start` | Start the Express server |

---

## Deployment

- The frontend deploys through `.github/workflows/deploy.yml`.
- Pushes to `main` build the Vite app and publish the `build/` directory to GitHub Pages.
- Set `VITE_API_URL` to your hosted backend endpoint (for example Render, Railway, Fly.io, or Supabase Edge Functions).
- In repository settings, set GitHub Pages source to GitHub Actions after the first successful workflow run.

---

## Contribution

1. Create a branch from `main` using `feature/<description>` or `fix/<description>`.
2. Keep changes focused and use conventional commit types (`feat`, `fix`, `chore`, and related).
3. Open a pull request to `main` with a concise summary and test notes.
4. Merge through GitHub UI. The deployment workflow will run automatically.

---

## Support

If you encounter a bug or need help, open an issue or comment on the relevant pull request and include:

- What you tried
- Relevant logs or screenshots
- Whether local backend and LLM services were running
- Clear steps to reproduce the issue
