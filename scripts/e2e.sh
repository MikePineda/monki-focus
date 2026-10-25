#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# End-to-end run against the real server stack, from a clean slate every time:
#   1. ephemeral Postgres + ntfy (docker-compose.test.yml, torn down with -v)
#   2. migrations on the E2E database, then the compiled server
#      (server/api/build) on the slot's port, with e2e/e2e.env
#   3. Playwright (e2e/) when its config exists; until then (scaffold) the
#      run checks the stack answers /api/health and stops there
# Build first: `npx turbo run build --filter=@monki-focus/api`.
# Extra arguments go to Playwright.
#
# Slots: every run owns one copy of the stack, picked by E2E_SLOT (an integer,
# default: the first free one). This script is the only place that turns a
# slot into names and ports; it exports them and compose, Playwright and the
# server read the environment.
#
#   slot  compose project      API     Postgres  ntfy    Playwright folders
#   0     monki-focus-e2e      3434    5434      8434    test-results, playwright-report
#   N     monki-focus-e2e-N    3434+N  5434+N    8434+N  test-results-N, playwright-report-N
#
# Slots stop at 7 so they never reach the dev stack (5442 / 8442) or the
# Japa services (5443 / 8443). A set E2E_SLOT that is taken stops the run.
# Teardown only removes this run's project and server.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_BUILD="$ROOT/server/api/build"
MAX_SLOT=7
# One directory per claimed slot, holding the owner's PID. They live in the
# clone's shared git directory, so every worktree of this checkout sees the
# same locks (outside a git checkout: the temp directory).
LOCKS="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || echo "${TMPDIR:-/tmp}")/e2e-slots"
mkdir -p "$LOCKS"

if [[ ! -f "$API_BUILD/bin/server.js" ]]; then
  echo "e2e: server build not found. Run 'npx turbo run build --filter=@monki-focus/api' first." >&2
  exit 1
fi

# Names and ports of a slot, as the variables compose, Playwright and the server read.
slot_env() {
  local slot=$1
  E2E_SLOT=$slot
  E2E_PROJECT="monki-focus-e2e"
  E2E_RESULTS_DIR="test-results"
  E2E_REPORT_DIR="playwright-report"
  if ((slot > 0)); then
    E2E_PROJECT+="-$slot"
    E2E_RESULTS_DIR+="-$slot"
    E2E_REPORT_DIR+="-$slot"
  fi
  E2E_API_PORT=$((3434 + slot))
  E2E_DB_PORT=$((5434 + slot))
  E2E_NTFY_PORT=$((8434 + slot))
}

# True when something already listens on one of the slot's ports or the slot's
# compose project still has containers (a run that was not torn down).
slot_busy() {
  slot_env "$1"
  local port
  for port in "$E2E_API_PORT" "$E2E_DB_PORT" "$E2E_NTFY_PORT"; do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
  done
  [[ -n "$(docker ps -aq --filter "label=com.docker.compose.project=$E2E_PROJECT")" ]]
}

# Claims a slot (mkdir is atomic, so two runs starting together never get the
# same one). A lock whose owner is gone is taken over.
LOCK=""
claim_slot() {
  local lock="$LOCKS/slot-$1" owner
  if mkdir "$lock" 2>/dev/null; then
    echo $$ >"$lock/pid"
    LOCK=$lock
    return 0
  fi
  owner="$(cat "$lock/pid" 2>/dev/null || true)"
  if [[ -n "$owner" ]] && ! kill -0 "$owner" 2>/dev/null; then
    rm -rf "$lock"
    claim_slot "$1"
    return
  fi
  return 1
}

release_slot() {
  if [[ -n "$LOCK" ]]; then
    rm -rf "$LOCK"
    LOCK=""
  fi
}

if [[ -n "${E2E_SLOT:-}" ]]; then
  if [[ ! "$E2E_SLOT" =~ ^[0-9]+$ ]] || ((E2E_SLOT > MAX_SLOT)); then
    echo "e2e: E2E_SLOT must be an integer from 0 to $MAX_SLOT (got '$E2E_SLOT')." >&2
    exit 1
  fi
  slot=$E2E_SLOT
  if ! claim_slot "$slot"; then
    echo "e2e: slot $slot is in use by another run (PID $(cat "$LOCKS/slot-$slot/pid" 2>/dev/null))." >&2
    exit 1
  fi
  if slot_busy "$slot"; then
    release_slot
    echo "e2e: slot $slot is busy (port $E2E_API_PORT/$E2E_DB_PORT/$E2E_NTFY_PORT taken or project $E2E_PROJECT has containers). Unset E2E_SLOT to pick a free one." >&2
    exit 1
  fi
else
  slot=""
  for candidate in $(seq 0 "$MAX_SLOT"); do
    if claim_slot "$candidate"; then
      if ! slot_busy "$candidate"; then
        slot=$candidate
        break
      fi
      release_slot
    fi
  done
  if [[ -z "$slot" ]]; then
    echo "e2e: no free slot from 0 to $MAX_SLOT." >&2
    exit 1
  fi
fi

slot_env "$slot"
export E2E_SLOT E2E_PROJECT E2E_RESULTS_DIR E2E_REPORT_DIR E2E_API_PORT E2E_DB_PORT E2E_NTFY_PORT
echo "e2e: slot $E2E_SLOT (project $E2E_PROJECT, API :$E2E_API_PORT, Postgres :$E2E_DB_PORT, ntfy :$E2E_NTFY_PORT)"

COMPOSE=(docker compose -p "$E2E_PROJECT" -f "$ROOT/docker-compose.test.yml")
API_PID=""

cleanup() {
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
  "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  release_slot
}
trap cleanup EXIT
# Ctrl-C and kill go through the EXIT trap too, so the stack never outlives the run.
trap 'exit 130' INT
trap 'exit 143' TERM

echo "e2e: starting docker-compose.test.yml"
TEST_DB_PORT="$E2E_DB_PORT" TEST_NTFY_PORT="$E2E_NTFY_PORT" "${COMPOSE[@]}" up -d --wait db ntfy

set -a
# shellcheck source=../e2e/e2e.env
source "$ROOT/e2e/e2e.env"
set +a
# The slot-dependent settings (e2e.env holds the rest).
export PORT="$E2E_API_PORT"
export APP_URL="http://127.0.0.1:$E2E_API_PORT"
export DB_PORT="$E2E_DB_PORT"
export NTFY_BASE_URL="http://127.0.0.1:$E2E_NTFY_PORT"
export NTFY_PUBLIC_URL="$NTFY_BASE_URL"
export E2E_BASE_URL="$APP_URL"

echo "e2e: migrating $DB_DATABASE"
(cd "$API_BUILD" && node ace migration:run --force)

echo "e2e: starting the server on :$E2E_API_PORT"
(cd "$API_BUILD" && exec node bin/server.js) &
API_PID=$!

for _ in $(seq 1 60); do
  if curl -fsS "$APP_URL/api/health" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "e2e: the server exited during startup" >&2
    exit 1
  fi
  sleep 0.5
done
curl -fsS "$APP_URL/api/health" >/dev/null || {
  echo "e2e: the server never turned healthy on $APP_URL" >&2
  exit 1
}
echo "e2e: server healthy: $(curl -fsS "$APP_URL/api/health")"

if [[ ! -f "$ROOT/e2e/playwright.config.ts" ]]; then
  echo "e2e: no e2e/playwright.config.ts yet (scaffold): stack verified, no journeys to run."
  exit 0
fi

echo "e2e: running Playwright on slot $E2E_SLOT"
(cd "$ROOT/e2e" && npx --no-install playwright test "$@")
