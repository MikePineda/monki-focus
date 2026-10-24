#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Fails unless the npm on PATH is at least the given version. CI installs with
# `npm ci --ignore-scripts` and then `npm rebuild --strict-allow-scripts`,
# which relies on the `allowScripts` policy of npm >= 11.19.0; an older npm
# would not enforce it. Node 24.20.0 and later bundle npm 11.19.x.
#
# Usage: bash scripts/ci/require-npm.sh [minimum-version]   (default 11.19.0)
set -euo pipefail

minimum="${1:-11.19.0}"
actual="$(npm --version)"

lowest="$(printf '%s\n%s\n' "$minimum" "$actual" | sort -V | head -n 1)"
if [[ "$lowest" != "$minimum" ]]; then
  echo "::error title=npm too old::npm ${actual} found, ${minimum} or later is required (allowScripts policy)."
  exit 1
fi
echo "npm ${actual} (>= ${minimum})"
