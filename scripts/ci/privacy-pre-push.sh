#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# lefthook pre-push: runs scripts/ci/privacy-check.sh with the maintainer's
# local pattern file, docs/internal/privacy-patterns.txt (gitignored, never
# committed). In a linked worktree the file is looked up in the main checkout
# too, because docs/internal/ only exists there. Without the file the generic
# checks still run. Any hit blocks the push.
set -euo pipefail

top="$(git rev-parse --show-toplevel)"
main_checkout="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"

for candidate in "$top/docs/internal/privacy-patterns.txt" "$main_checkout/docs/internal/privacy-patterns.txt"; do
  if [[ -f "$candidate" ]]; then
    PRIVACY_PATTERNS_FILE="$candidate" exec bash "$top/scripts/ci/privacy-check.sh"
  fi
done

exec bash "$top/scripts/ci/privacy-check.sh"
