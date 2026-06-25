#!/usr/bin/env bash
# Idempotent dev-environment setup for the Equine Directory.
# Safe to run repeatedly; used by the Claude Code SessionStart hook so the
# autonomous build loop self-heals after the ephemeral container is recycled.
#
# It ensures: a local PostgreSQL, the dev + shadow databases, the web/.env and
# web/.devenv files, and the pre-fetched Prisma engines (Prisma's own downloader
# is blocked by the agent proxy; curl works, so we fetch the engines directly).
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$REPO_ROOT/web"
CA="/root/.ccr/ca-bundle.crt"
PG_USER="postgres"
PG_PASS="postgres"
DB="equine_directory"
SHADOW="equine_shadow"

log() { echo "[setup-dev] $*"; }

# 1. PostgreSQL ------------------------------------------------------------
if ! command -v psql >/dev/null 2>&1; then
  log "installing postgresql..."
  apt-get install -y postgresql postgresql-contrib >/dev/null 2>&1 || true
fi
service postgresql start >/dev/null 2>&1 || true
for _ in $(seq 1 10); do
  su - postgres -c "psql -c 'SELECT 1' >/dev/null 2>&1" && break
  sleep 1
done
su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='$PG_USER'\" | grep -q 1" \
  || su - postgres -c "psql -c \"CREATE ROLE $PG_USER LOGIN SUPERUSER PASSWORD '$PG_PASS';\"" >/dev/null 2>&1
su - postgres -c "psql -c \"ALTER USER $PG_USER PASSWORD '$PG_PASS';\"" >/dev/null 2>&1
for d in "$DB" "$SHADOW"; do
  su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='$d'\" | grep -q 1" \
    || su - postgres -c "psql -c \"CREATE DATABASE $d OWNER $PG_USER;\"" >/dev/null 2>&1
done
log "postgres ready (db=$DB shadow=$SHADOW)"

# 2. web/.env (dev) --------------------------------------------------------
if [ ! -f "$WEB/.env" ]; then
  cat > "$WEB/.env" <<EOF
DATABASE_URL="postgresql://$PG_USER:$PG_PASS@127.0.0.1:5432/$DB?schema=public"
SHADOW_DATABASE_URL="postgresql://$PG_USER:$PG_PASS@127.0.0.1:5432/$SHADOW?schema=public"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
NODE_EXTRA_CA_CERTS="$CA"
EOF
  log "wrote web/.env"
fi

# 2b. Web dependencies (skip Prisma's failing engine postinstall) ----------
if [ -f "$WEB/package.json" ] && [ ! -d "$WEB/node_modules/@prisma/client" ]; then
  log "installing web dependencies (--ignore-scripts)..."
  ( cd "$WEB" && NODE_EXTRA_CA_CERTS="$CA" npm install --ignore-scripts >/dev/null 2>&1 ) || true
fi

# 3. Prisma engines (proxy blocks Prisma's downloader; curl works) ---------
ENGDIR="$WEB/prisma/engines"
TARGET="debian-openssl-3.0.x"
if [ -d "$WEB/node_modules/@prisma/engines-version" ]; then
  HASH="$(node -e "console.log(require('$WEB/node_modules/@prisma/engines-version').enginesVersion)" 2>/dev/null)"
  SCHEMA_BIN="$ENGDIR/schema-engine-$TARGET"
  QUERY_LIB="$ENGDIR/libquery_engine-$TARGET.so.node"
  if [ -n "${HASH:-}" ] && { [ ! -f "$SCHEMA_BIN" ] || [ ! -f "$QUERY_LIB" ]; }; then
    log "fetching prisma engines ($HASH)..."
    mkdir -p "$ENGDIR"
    BASE="https://binaries.prisma.sh/all_commits/$HASH/$TARGET"
    curl -fsS -o "$ENGDIR/schema-engine.gz" --max-time 180 "$BASE/schema-engine.gz" \
      && gunzip -f "$ENGDIR/schema-engine.gz" && mv -f "$ENGDIR/schema-engine" "$SCHEMA_BIN" && chmod +x "$SCHEMA_BIN"
    curl -fsS -o "$ENGDIR/libquery_engine.so.node.gz" --max-time 180 "$BASE/libquery_engine.so.node.gz" \
      && gunzip -f "$ENGDIR/libquery_engine.so.node.gz" && mv -f "$ENGDIR/libquery_engine.so.node" "$QUERY_LIB"
  fi
  # web/.devenv — sourced before prisma/next commands
  cat > "$WEB/.devenv" <<EOF
export NODE_EXTRA_CA_CERTS=$CA
export PRISMA_SCHEMA_ENGINE_BINARY="$SCHEMA_BIN"
export PRISMA_QUERY_ENGINE_LIBRARY="$QUERY_LIB"
export PRISMA_CLI_QUERY_ENGINE_TYPE=library
export PRISMA_QUERY_ENGINE_TYPE=library
EOF
  log "prisma engines ready; web/.devenv written"
fi

log "done. Source web/.devenv before running prisma/next commands."
