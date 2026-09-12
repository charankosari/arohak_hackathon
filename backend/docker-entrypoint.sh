#!/bin/sh
# Container entrypoint for the Meridian Grand API.
#
# Migrations are opt-in: set RUN_MIGRATIONS=true so a redeploy applies pending
# schema changes. It is deliberately not the default, because several replicas
# starting at once would otherwise race to migrate the same database.
set -e

if [ "${RUN_MIGRATIONS}" = "true" ]; then
  echo "[entrypoint] applying database migrations"
  npx prisma migrate deploy
fi

if [ "${RUN_SEED}" = "true" ]; then
  echo "[entrypoint] seeding demo data"
  node prisma/seed.js
fi

echo "[entrypoint] starting: $*"
exec "$@"
