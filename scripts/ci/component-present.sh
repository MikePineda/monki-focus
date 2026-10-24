#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Tells a CI job whether the component it builds exists yet.
#
# Usage: bash scripts/ci/component-present.sh <marker-file> [<marker-file>...]
#
# Writes `present=true` to $GITHUB_OUTPUT when every marker file exists;
# otherwise writes `present=false` and a notice, so the job's remaining steps
# (guarded with `if: steps.<id>.outputs.present == 'true'`) are skipped and
# the job passes. Outside GitHub Actions it prints the result instead.
set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo 'usage: component-present.sh <marker-file>...' >&2
  exit 2
fi

present=true
for marker in "$@"; do
  if [[ ! -e "$marker" ]]; then
    present=false
    echo "::notice title=Component not present::${marker} does not exist yet; skipping this job's build steps."
  fi
done

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "present=${present}" >>"$GITHUB_OUTPUT"
else
  echo "present=${present}"
fi
