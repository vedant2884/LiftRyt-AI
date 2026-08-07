# LiftRyt AI

A gym companion web app: an AI coach with memory (RAG + tool calling) backed by
real fitness tooling — weight tracking with trend analytics, an exercise
database, workout logging, a rule-based workout-split generator, and
macro/calorie calculators.

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

## Architecture

The short version, for a resume bullet or a two-minute interview answer: **the
AI coach is an agent loop over the app's own already-correct backend
services, not a chatbot wrapper.** Everything below expands on why that
distinction is the actual engineering content of this project.

**The agent loop is real control flow, not a mega-prompt.**
`backend/app/services/agent.py` is: retrieve context → call the LLM with
tool definitions → if it requests a tool, execute the real service function
and feed the result back → final response. The two tools
(`generate_workout_split`, `calculate_macros`) are the *exact* functions
`POST /splits/generate` and `POST /macros/calculate` use — the model never
generates a split or estimates macro numbers itself, it only decides *when*
to call something and narrates *why*, using the deterministic `reason`
strings those services already compute. This is what makes the "explainable
AI" behavior possible: the explanation is real rule output, not the model
making up a justification after the fact.

**RAG is retrieval before generation, in code.**
`backend/app/services/coach_context.py` assembles weight trend, PRs,
training volume, active macro target, and — via pgvector cosine similarity
over `sentence-transformers` embeddings — exercises semantically relevant to
the user's specific message, all *before* the LLM sees anything. The
semantic search is demonstrably doing something keyword search can't: a
query like "something gentle for a sore lower back" (a phrase that appears
nowhere in the exercise library) returns Back Squat, Good Morning, and
Romanian Deadlift via embedding similarity, while the equivalent keyword
search returns zero results.

**The LLM provider is a config value, not a code branch.**
Groq and Ollama both speak the OpenAI-compatible chat-completions API
(including tool calling), so `backend/app/services/llm/provider.py` just
points the same client at a different `base_url`/model. Swapping providers
is `LLM_PROVIDER=groq|ollama` in `.env` — no rewritten call sites, no
provider-specific branching in the agent loop itself.

**SQL analytics are real queries, not ORM aggregation hidden behind
abstractions.** A few specific techniques, each chosen because it was the
right tool for that number:
- `AVG() OVER (... RANGE BETWEEN INTERVAL ...)` for weight moving averages —
  `RANGE`, not `ROWS`, so a gap in logging doesn't shrink the calendar window.
- `regr_slope()`/`regr_intercept()` — Postgres's built-in least-squares
  regression — for the weight trend line, instead of hand-rolling linear
  regression in Python.
- `DISTINCT ON (exercise_id) ORDER BY exercise_id, weight_kg DESC` for
  personal records — Postgres's "top row per group" idiom.
- A join + `unnest()` over a Postgres array column
  (`exercises.primary_muscles`) for per-muscle volume, rolled up by
  `GROUP BY date_trunc('week', ...)`.
- A partial unique index (`WHERE is_active`) on `macro_targets` enforcing
  "one active target per user" at the database level while preserving full
  history underneath.

**Schema decisions favor one source of truth over convenience columns.**
There's no `current_weight` column on `users` — it's derived from the
latest `weight_logs` row, so profile and history can't silently drift apart.
PRs aren't stored either; `is_new_pr` compares a new set's weight against
`MAX()` of prior non-warmup sets at write time, so "is this a PR" is always
answered from real history, never a cached flag that can go stale.

**Auth uses a hybrid token model on purpose.** Access tokens are stateless
JWTs (fast, no DB hit per request); refresh tokens are opaque random
strings, SHA-256 hashed and stored server-side specifically so they can be
revoked and rotated — something a bare stateless refresh JWT can't do. The
refresh token itself lives in an httpOnly, `Path=/auth`-scoped cookie, never
touched by JS, while the access token stays in memory only (no
`localStorage`) to reduce the blast radius of an XSS payload.

**A handful of real bugs were caught by actually testing, not by design
review alone** — worth naming because they're the kind of thing that only
surfaces when you run the thing: Python's banker's rounding
(`round(0.5) == 0`) silently breaking the split generator's compound/isolation
allocation for single-slot categories; Alembic's autogenerate never
emitting `DROP TYPE` for Postgres enums, which breaks a downgrade→upgrade
cycle unless patched by hand; a warmup set's weight being included in one
volume calculation but excluded from another, so the same workout showed
two different numbers in different parts of the UI; and
`sentence-transformers` doing a network freshness-check on every model load
(including after every dev server reload) that could stall or crash a
request when the network hiccuped, fixed by forcing offline mode once the
model is confirmed cached.

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

### AI coach (Groq / Ollama)

The coach is a small agent loop (`backend/app/services/agent.py`): user
message → retrieve context (weight trend, PRs, training volume, active
macro target, and semantically relevant exercises via the RAG pipeline
above) → let the model decide whether to call a tool → run the tool for
real against the actual database → final natural-language response. The
model never generates a workout split or estimates macro numbers itself —
`generate_workout_split` and `calculate_macros` (steps 7-8) are exposed as
tools it calls, so its answers are grounded in the same deterministic logic
those features already use.

**Provider abstraction:** Groq and Ollama both expose an OpenAI-compatible
chat-completions API (including tool calling), so
`backend/app/services/llm/provider.py` returns the same client pointed at a
different `base_url`/model — set in `backend/.env`:

```bash
# Groq (default) — free tier, fast, needs a key from console.groq.com
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile

# Ollama — fully local, no account. Either install it natively (the default
# OLLAMA_BASE_URL=http://host.docker.internal:11434 already points at that),
# or run it in Docker:
#   docker compose --profile ollama up -d ollama
#   docker compose exec ollama ollama pull llama3.2
# ...then in backend/.env:
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434   # only when using the dockerized profile
OLLAMA_MODEL=llama3.2
```

After changing `backend/.env`, the backend container needs to be
**recreated**, not just restarted — `env_file` values are read at container
creation, so `docker compose restart backend` won't pick up the change;
use `docker compose up -d backend` (Compose recreates it automatically
when it detects the change) or `--force-recreate` if it doesn't.

Try it: log in, open **Coach**, and ask for a workout split or your
macros — the response explains *why* each exercise or number was chosen,
using the same `reason` strings the split generator (step 8) computes.
The **Weekly check-in** button generates an on-demand recap (weight trend +
training volume + one specific suggestion) from real logged data in a
single LLM call.

### Theme system

Light/dark mode and an accent color (violet or emerald) are both real,
persisted preferences — not just a CSS toggle. `users.theme` and
`users.accent_color` (the latter added in step 11's migration) are saved via
the same `PATCH /auth/me` from step 3, and `frontend/src/store/themeStore.ts`
stamps `data-theme`/`data-accent` attributes onto `<html>` on login and on
every change; `frontend/src/index.css` maps those attributes to CSS custom
properties, which Tailwind v4's `@theme` block turns into ordinary utility
classes (`bg-surface`, `text-ink`, `bg-accent`, ...) that resolve at
*runtime*, not at Tailwind's build time — the mechanism that makes a live
toggle possible at all instead of needing a page reload.

Status/identity colors (PR difficulty badges, push/pull/legs/core category
badges, delete-button red) are deliberately **not** theme tokens — they stay
literal Tailwind colors so a badge's meaning never depends on which accent
the viewer happens to have picked, matching the dataviz skill's "status
colors are fixed, never themed" rule.

Try it: **Settings** → switch mode and accent, then reload — the choice
survives (it's reading your saved profile, not local-only state) and every
page, including the Recharts charts (`frontend/src/lib/chartTheme.ts` picks
a light or dark categorical palette to match), follows it.

Units (kg/lb, cm/in) are also real, saved preferences, applied to weight and
height wherever they're the primary figure (dashboard, weight tracker) —
scoped there deliberately rather than as an exhaustive retrofit of every
numeric label across the app, since that's a large, mostly mechanical task
orthogonal to the theme system itself.

### Running tests

Backend (Pytest — unit tests for the pure calculator/generator functions,
integration tests for the SQL-heavy analytics against a real dedicated
`liftryt_test` database, created automatically on first run and never the
dev `liftryt` database):

```bash
docker compose exec backend pytest -v
```

The integration tests are worth reading even if you don't run them — in
particular `tests/integration/test_workout_analytics.py`'s warmup-exclusion
tests exist specifically to lock in a real bug found by hand in step 6 (a
warmup set's weight was counted in one volume calculation and excluded from
another), and `tests/unit/test_split_generator.py`'s rounding tests lock in
the banker's-rounding bug from step 8.

Frontend (Vitest + React Testing Library — a pure-function test, a hook
test with fake timers, and a component test):

```bash
docker compose exec frontend npm run test
```

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
