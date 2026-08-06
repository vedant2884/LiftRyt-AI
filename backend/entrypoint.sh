#!/bin/sh
set -e

alembic upgrade head
python -m app.db.seed_exercises
python -m app.db.embed_exercises

# By this point sentence-transformers has already downloaded and cached the
# model (embed_exercises.py just used it). Without this, every model load —
# including after every --reload restart — does a network freshness-check
# to huggingface.co first; when that's slow or unreachable it stalls (and
# can even fail) the first embedding call of each process instead of just
# using the cache that's already sitting right there.
export HF_HUB_OFFLINE=1
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
