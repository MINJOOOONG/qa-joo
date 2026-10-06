#!/usr/bin/env bash
# Runs the repository contract tests against PostgREST (the data API Supabase uses) backed by
# a Postgres database that already has supabase/migrations applied and the anon / authenticated /
# service_role / authenticator roles created (see .github/workflows/ci.yml for the exact SQL).
#
#   DATABASE_URL=postgres://authenticator:authpass@127.0.0.1:5432/postgres \
#   POSTGREST_BIN=./postgrest scripts/supabase-contract.sh
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL for the authenticator role}"
POSTGREST_BIN="${POSTGREST_BIN:-postgrest}"
JWT_SECRET="${JWT_SECRET:-qa-joo-local-jwt-secret-at-least-32-chars}"

PGRST_DB_URI="$DATABASE_URL" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
  PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_PORT=3001 "$POSTGREST_BIN" > /tmp/qa-joo-postgrest.log 2>&1 &
POSTGREST_PID=$!
node scripts/postgrest-gateway.mjs > /tmp/qa-joo-gateway.log 2>&1 &
GATEWAY_PID=$!
trap 'kill $POSTGREST_PID $GATEWAY_PID 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  curl -sf -o /dev/null http://127.0.0.1:54321/rest/v1/ && break
  sleep 1
done

SUPABASE_TEST_URL=http://127.0.0.1:54321 \
SUPABASE_TEST_SERVICE_ROLE_KEY="$(node scripts/service-jwt.mjs "$JWT_SECRET")" \
  npx vitest run src/lib/db/repository.contract.test.ts
