#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Runs the Bruno smoke collection (server/api/bruno) with a pinned CLI.
#
#   npm run smoke:local -w server/api    # http://localhost:3433 (docker compose up)
#   npm run smoke:prod -w server/api     # SMOKE_BASE_URL, after every deploy
#
# Extra arguments go to `bru run` (e.g. `--reporter-junit /tmp/smoke.xml`).
# `bru run` only works with the collection root as the working directory, and
# `npx` inside an npm workspace moves it, so the binary is resolved first.
# Credentials (SMOKE_*) and SMOKE_BASE_URL come from the shell or
# server/api/bruno/.env (gitignored); the repository never names a domain.
set -euo pipefail

BRUNO_CLI_VERSION="4.3.0"

env_name="${1:-}"
if [[ "$env_name" != "local" && "$env_name" != "prod" ]]; then
  echo "usage: bin/smoke.sh local|prod [bru run flags]" >&2
  exit 2
fi
shift

collection_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../bruno" && pwd)"

if [[ "$env_name" == "prod" && -z "${SMOKE_BASE_URL:-}" ]] \
  && ! grep -q '^SMOKE_BASE_URL=.' "$collection_dir/.env" 2>/dev/null; then
  echo "smoke:prod needs SMOKE_BASE_URL (https://<your-instance>): export it or add it to" >&2
  echo "server/api/bruno/.env (gitignored)." >&2
  exit 2
fi

bru_bin="$(npx --yes --package "@usebruno/cli@${BRUNO_CLI_VERSION}" -c 'command -v bru')"

cd "$collection_dir"
exec "$bru_bin" run --env "$env_name" --bail "$@"
