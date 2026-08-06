FROM python:3.12-slim

WORKDIR /app

# System deps for building any C-extension wheels (e.g. psycopg, pgvector).
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Runs pending Alembic migrations before starting the dev server, so
# `docker compose up` alone is enough to get a fully migrated DB — no
# separate manual migration step for local dev.
# Invoked as `sh entrypoint.sh` (not './entrypoint.sh') because the file is
# bind-mounted from the host at runtime, where its executable bit isn't
# reliably preserved (e.g. Windows hosts).
CMD ["sh", "entrypoint.sh"]
