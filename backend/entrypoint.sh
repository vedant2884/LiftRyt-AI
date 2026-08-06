#!/bin/sh
set -e

alembic upgrade head
python -m app.db.seed_exercises
python -m app.db.embed_exercises
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
