# 🤖 InterviewAI Pro

AI-first mock interview coach that blends live video practice, real‑time analytics, and personalized study plans into a single experience. The platform pairs a React/Vite front-end with an Express/Firebase backend, plus local LLM + Whisper pipelines for zero-cost coaching.

---

## ✨ Highlights

- **Candidate + Company Dashboards** – Personalized insights, progress tracking, and quick actions for both sides of the hiring loop.
- **Live AI Interview Session** – Real-time question flow, pose analysis, interviewer chat, and feedback panel.
- **AI Career Assistant** – Context-aware chat assistant that can analyze sessions, generate study plans, or answer follow-up questions (text + mic).
- **Voice + Pose Intelligence** – Local Whisper transcription, Ollama-powered scoring, and MediaPipe pose coaching.
- **Secure Backend APIs** – Express server with JWT auth, Firebase integrations, rate limiting, validation, and Socket.IO.

---

## 🧱 Architecture Snapshot

| Layer | Responsibilities | Key Tech |
| --- | --- | --- |
| Frontend (`src/`) | Vite/React SPA, dashboards, live interview UI, AI assistant, pose overlays | React 18, Vite, Tailwind CSS, Lucide, MediaPipe |
| Backend (`server/`) | Auth, analytics, interview orchestration, Firebase + Supabase adapters, sockets | Node.js, Express, Firebase Admin, Socket.IO, Winston |
| AI/ML Services | Local inference with zero API spend | Ollama (LLM), Whisper server (Python), MediaPipe |
| Deployment | Static app via GitHub Pages + API hosted separately | GitHub Actions Pages workflow, ENV-based API URL |

---

## 🧰 Tech Stack

- **Core**: React 18, Vite 5, Tailwind CSS, Redux Toolkit, React Hook Form
- **3rd Party UI/Dev**: Framer Motion, Lucide, Radix Slot, D3/Recharts
- **Server**: Express 4, Firebase Admin, JWT, CORS/Helmet, Socket.IO, Winston
- **AI + Realtime**: Local Ollama, Faster-Whisper server, MediaPipe Tasks Vision
- **Tooling**: ESLint (CRA base), npm, GitHub Actions (Pages), Nodemon

---

## 📁 Project Structure

```
.
├── src/                     # React + Vite SPA
│   ├── components/          # Shared UI + layout pieces
│   ├── pages/               # Route-based feature modules
│   ├── services/            # API, LLM, audio, pose helpers
│   ├── hooks/contexts/      # State + feature hooks
│   └── styles/              # Tailwind + global CSS
├── server/                  # Express API + socket server
│   ├── src/                 # Config, controllers, middleware, routes
│   ├── prisma/              # (placeholder for DB schema)
│   └── whisper_server.py    # Optional local Whisper endpoint
├── public/                  # Static assets + manifest
├── .github/workflows/       # GitHub Pages deploy pipeline
└── README.md                # You are here
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Python 3.10+ (if running the optional `whisper_server.py`)
- Ollama installed locally for free LLM inference ([docs](https://ollama.ai))

### 1. Clone & Install

```bash
git clone https://github.com/Akiyoshi02/InterviewAI-Pro.git
cd InterviewAI-Pro
npm install                 # Frontend dependencies

cd server
npm install                 # Backend dependencies
cd ..
```

### 2. Environment Variables

Create a root `.env` for the Vite app:

```bash
VITE_API_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_OLLAMA_URL=http://localhost:11434
VITE_OLLAMA_MODEL=llama3.1:8b
VITE_LOCAL_WHISPER_URL=http://localhost:5000
```

Copy `server/.env.example` to `server/.env` and populate the values (Firebase Admin, Sightengine keys, Ollama, Whisper, etc.).

### 3. Run Locally

```bash
# Terminal 1 – API + sockets
cd server
npm run dev

# Terminal 2 – Frontend
cd ..
npm run dev
# default Vite port: 4028 (configured in vite.config.mjs)
```

Optional services:

- **Ollama**: `ollama run llama3.1:8b` (or your chosen model)
- **Local Whisper**: `python server/whisper_server.py`

---

## 📜 Available Scripts

| Location | Command | Description |
| --- | --- | --- |
| `/` | `npm run dev` | Launch Vite dev server |
| `/` | `npm run build` | Production build to `build/` |
| `/` | `npm run serve` | Preview built assets |
| `/server` | `npm run dev` | Nodemon hot reload server |
| `/server` | `npm start` | Start Express server |

---

## 🚢 Deployment (GitHub Pages + API)

- Static site is deployed via `.github/workflows/deploy.yml`. Every push to `main` builds the Vite app and publishes the `build/` folder to GitHub Pages.
- Set the backend URL via `VITE_API_URL` to point to your hosted Express instance (e.g., Render, Railway, Fly.io, Supabase Edge Functions).
- Remember to enable GitHub Pages → “GitHub Actions” in repo settings after the first successful workflow run.

---

## 🤝 Contribution Flow

1. Branch from `main` using `feature/<kebab-description>` or `fix/<kebab-description>`.
2. Make focused changes + write conventional commits (`feat`, `fix`, `chore`, etc.).
3. Open a PR back into `main` with a concise summary + testing notes (see project workflow memory).
4. Merge via GitHub UI; the Pages deploy workflow will run automatically.

---

## 📮 Support

Have questions or find a bug? Open an issue or ping in the PR comments and include:

- What you tried (screenshots/logs appreciated)
- Whether you were running the local backend/LLM services
- Steps to reproduce

Happy interviewing! 🎤💼

