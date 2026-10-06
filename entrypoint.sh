#!/bin/sh

echo "[entrypoint] Running Prisma Migrate Deploy..."
DATABASE_URL="${DATABASE_URL}" npx prisma migrate deploy || echo "[entrypoint] WARN: prisma migrate deploy returned non-zero (continuing)"

echo "[entrypoint] Running Prisma DB Seed..."
DATABASE_URL="${DATABASE_URL}" \
AUTH_SECRET="${AUTH_SECRET}" \
NEXTAUTH_URL="${NEXTAUTH_URL}" \
TZ="${TZ}" \
SEED_MASTER_EMAIL="${SEED_MASTER_EMAIL}" \
SEED_MASTER_PASSWORD="${SEED_MASTER_PASSWORD}" \
SEED_MASTER_NAME="${SEED_MASTER_NAME}" \
NODE_ENV="${NODE_ENV}" \
npx prisma db seed || echo "[entrypoint] WARN: prisma db seed returned non-zero (continuing)"

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
