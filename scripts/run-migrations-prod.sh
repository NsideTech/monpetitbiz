#!/usr/bin/env bash
# Run TypeORM migrations against production Postgres (e.g. Supabase).
#
# Prefer one of:
#   - DATABASE_URL_MIGRATE / DIRECT_URL = Supabase "Session pool" URI on port 5432 (same host as
#     transaction pooler, user postgres.<ref>) — TypeORM sets SSL; do not add ?sslmode=require
#     to the URL or node may verify certs and fail.
#   - Or "Direct connection" (db.<ref>.supabase.co:5432) if your network resolves IPv6.
#
# Usage:
#   export DATABASE_URL_MIGRATE='postgresql://postgres.<ref>:PASSWORD@aws-..pooler.supabase.com:5432/postgres'
#   ./scripts/run-migrations-prod.sh
#
# Optional: pull other vars from Vercel (does not override DATABASE_URL_MIGRATE if already set).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${DATABASE_URL_MIGRATE:-}" && -z "${DIRECT_URL:-}" ]]; then
  echo "Neither DATABASE_URL_MIGRATE nor DIRECT_URL is set."
  echo "Add one of them with Supabase → Settings → Database → Connection string → Direct (URI), then re-run."
  echo "Example: export DATABASE_URL_MIGRATE='postgresql://postgres:***@db.<ref>.supabase.co:5432/postgres'"
  exit 1
fi

npm run migration:run
