#!/usr/bin/env bash
# Applies every file in supabase/migrations to an empty database, in order, each in its own
# transaction (the way the Supabase CLI does), and stops at the first failure.
#
# Usage: supabase/tests/apply-migrations.sh [--keep-going]
# Connection: the standard PG* variables (PGHOST, PGPORT, PGUSER, PGPASSWORD). The script
# drops and recreates the database named by DB_NAME (default "alhikmah_migration_check").
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
migrations="${MIGRATIONS_DIR:-$here/../migrations}"
db="${DB_NAME:-alhikmah_migration_check}"
keep_going=0
[ "${1:-}" = "--keep-going" ] && keep_going=1

export LC_ALL=C
failures=0

# 1. File names: a unique numeric version, then a lowercase name (Supabase CLI rule).
names="$(ls "$migrations" | sort)"
bad="$(echo "$names" | grep -v -E '^[0-9]{3,}_[a-z0-9_]+\.sql$' || true)"
if [ -n "$bad" ]; then
  echo "Bad migration file names (expected NNN_name.sql):"
  echo "$bad" | sed 's/^/  /'
  failures=$((failures + 1))
fi
dups="$(echo "$names" | sed 's/_.*//' | uniq -d || true)"
if [ -n "$dups" ]; then
  echo "Duplicate migration versions (each version must be used once):"
  for v in $dups; do echo "$names" | grep "^${v}_" | sed 's/^/  /'; done
  failures=$((failures + 1))
fi

# 2. Fresh database with the Supabase compatibility layer.
psql -X -q -v ON_ERROR_STOP=1 -d postgres \
  -c "drop database if exists \"$db\" with (force)" \
  -c "create database \"$db\"" || exit 2
psql -X -q -v ON_ERROR_STOP=1 -v dbname="$db" -d "$db" -f "$here/shim.sql" || exit 2

# 3. Every migration, in version order.
for f in $names; do
  case "$f" in *.sql) ;; *) continue ;; esac
  if ! out="$(psql -X -q -v ON_ERROR_STOP=1 --single-transaction -d "$db" -f "$migrations/$f" 2>&1)"; then
    echo "FAILED $f"
    echo "$out" | grep -E "ERROR|LINE|DETAIL|HINT|CONTEXT" | head -8 | sed 's/^/  /'
    failures=$((failures + 1))
    [ "$keep_going" -eq 0 ] && break
  fi
done

if [ "$failures" -eq 0 ]; then
  echo "All $(echo "$names" | wc -l | tr -d ' ') migrations applied cleanly."
  exit 0
fi
exit 1
