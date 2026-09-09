#!/bin/bash
# Apply all pending SQL migrations in lexical order.
# Idempotent: each migration must be safe to re-run.
set -euo pipefail
DB_USER="${DB_USER:-documentflow}"
DB_NAME="${DB_NAME:-documentflow}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PASS="${DB_PASS:-$(cat /tmp/df_db_pass.txt 2>/dev/null || true)}"
if [[ -z "$DB_PASS" ]]; then
  echo "DB password not found (looked at /tmp/df_db_pass.txt)" >&2
  exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"
shopt -s nullglob
for f in "$DIR"/[0-9]*.sql; do
  echo "==> applying $(basename "$f")"
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$f"
done
echo "==> done"