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

Note: `frontend/vite.config.ts` enables polling-based file watching
(`server.watch.usePolling`). Docker Desktop's bind mounts on Windows/macOS
don't reliably forward native filesystem events into the container, so
without polling, edits can silently fail to trigger HMR — you'd be looking
at stale content and not know it. Costs a bit of CPU; worth it for
hot-reload you can actually trust.

### Database migrations (Alembic)

The schema lives in `backend/app/models/` (SQLAlchemy 2.0) and is versioned
with Alembic migrations in `backend/alembic/versions/`. The backend's
`entrypoint.sh` runs `alembic upgrade head` before starting the dev server,
so `docker compose up` alone brings up a fully migrated DB — no manual
migration step for local dev. Run Alembic commands inside the running
backend container so they use the same DB connection as the app:

```bash
# after changing a model, generate a new migration and review it before applying
docker compose exec backend alembic revision --autogenerate -m "describe the change"
docker compose exec backend alembic upgrade head

# roll back one migration
docker compose exec backend alembic downgrade -1
```

Note: Alembic's autogenerate does **not** emit `DROP TYPE` for Postgres enums
on downgrade (it only diffs tables/columns). When a migration adds enum
columns, add the corresponding `DROP TYPE IF EXISTS ...` statements to its
`downgrade()` by hand — see `1ede5e6ec696_init_schema.py` for the pattern.
Otherwise a downgrade-then-upgrade cycle fails with "type already exists".

### RAG pipeline (embeddings + pgvector)

The exercise library is embedded locally via `sentence-transformers`
(`all-MiniLM-L6-v2`, 384 dimensions, no paid API) and stored in a pgvector
`vector(384)` column with an HNSW index. `entrypoint.sh` runs the backfill
(`app/db/embed_exercises.py`) after seeding, so a fresh DB ends up fully
embedded with no manual step — but expect the **first-ever** `docker compose
up` to take noticeably longer than later ones: it's downloading the model
weights (~90MB) in addition to installing `torch`/`sentence-transformers`
into the image. The model is cached in the `hf_cache` named volume, so
`docker compose up`/`restart` after that first run doesn't re-download it —
only `docker compose down -v` (which removes volumes) would.

Try it: log in, go to Exercises, switch to "Semantic" search, and search
something like *"something gentle for a sore lower back"* — no exercise
name or description literally contains those words, but relevant results
(Back Squat, Good Morning, Romanian Deadlift) still surface, unlike the
keyword search next to it.

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
