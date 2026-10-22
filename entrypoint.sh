#!/bin/sh

set -eu

echo "[entrypoint] Running Prisma Migrate Deploy..."
npx prisma migrate deploy

# Explicit bootstrap only; ordinary restarts must not seed operational data.
if [ "${RUN_BOOTSTRAP_SEED:-false}" = "true" ]; then
  echo "[entrypoint] Running explicitly enabled Prisma DB Seed..."
  npx prisma db seed
else
  echo "[entrypoint] Skipping seed (RUN_BOOTSTRAP_SEED is not true)."
fi

echo "[entrypoint] === NFT FIX RUNTIME: Copiando api/agents ORIGINAL para .next/server/app/api ==="
mkdir -p /app/.next/server/app/api 2>/dev/null || true
if [ -d /tmp/nft-originals/api-agents ]; then
  rm -rf /app/.next/server/app/api/agents 2>/dev/null || true
  cp -R /tmp/nft-originals/api-agents /app/.next/server/app/api/agents
  echo "[entrypoint] NFT FIX OK: api/agents copiado runtime"
  find /app/.next/server/app/api -maxdepth 5 -type f -name "route.js" 2>/dev/null | sort || true
else
  echo "[entrypoint] NFT FIX WARN: /tmp/nft-originals/api-agents NAO EXISTE"
fi

echo "[entrypoint] Starting Next.js Standalone Server..."
exec "$@"
