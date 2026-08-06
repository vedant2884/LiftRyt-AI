# LiftRyt AI

A gym companion web app: an AI coach with memory (RAG + tool calling) backed by
real fitness tooling — weight tracking with trend analytics, an exercise
database, workout logging, a rule-based workout-split generator, and
macro/calorie calculators.

**Status:** under active build. This README grows alongside the project; a
full architecture write-up lands in the final step.

## Stack

| Layer    | Choice                                                          |
| -------- | ---------------------------------------------------------------- |
| Frontend | React + TypeScript (strict), Vite, Tailwind CSS v4, Framer Motion, Recharts, Zustand |
| Backend  | Python, FastAPI (async), Pydantic v2, SQLAlchemy 2.0, Alembic    |
| Database | PostgreSQL + pgvector                                            |
| Cache    | Redis                                                             |
| LLM      | Groq (free tier, primary) with local Ollama as a dev-mode fallback — swapped via `LLM_PROVIDER` |
| Auth     | JWT (access + refresh), bcrypt password hashing                  |

## Project structure

```
liftryt-ai/
  backend/    # FastAPI app, SQLAlchemy models, Alembic migrations, services/agent.py, routers/
  frontend/   # React + TS + Vite app
  docker-compose.yml
```

## Local development setup

Prerequisites: Docker Desktop (with Docker Compose).

```bash
# 1. Copy env templates (defaults are dev-safe; only needed if you deleted the
#    committed .env files or want to change ports/credentials)
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. Start everything
docker compose up --build
```

This brings up four services:

- **postgres** — `pgvector/pgvector:pg16`, port `5432`
- **redis** — port `6379`
- **backend** — FastAPI on [http://localhost:8000](http://localhost:8000), hot-reloads on file changes (bind-mounted)
- **frontend** — Vite dev server on [http://localhost:5173](http://localhost:5173), hot-reloads on file changes

Visit [http://localhost:5173](http://localhost:5173) — the page pings the
backend's `/health` endpoint on load, so a green dot confirms the whole stack
(frontend → backend, and backend → CORS config) is wired correctly end to
end.

Backend interactive API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### Running services individually (without Docker)

Backend:

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Note: outside Docker you'll need Postgres/Redis running locally yourself, or
point `DATABASE_URL`/`REDIS_URL` at Dockerized instances.
