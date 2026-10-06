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

echo "[entrypoint] Starting Next.js Standalone Server..."
exec "$@"
