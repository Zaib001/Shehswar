#!/bin/sh
set -e

echo "🔄 Running automated database synchronization..."
npx prisma db push --skip-generate --schema=./packages/database/prisma/schema.prisma || true

echo "🔑 Ensuring Administrator credentials are active..."
npx tsx packages/database/src/seed-admin.ts || true

echo "🚀 Starting SHEHSWAR ONE360 Backend API..."
exec node apps/api/dist/main.js
