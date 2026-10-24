#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Release jobs build the commit that triggered the workflow ($GITHUB_SHA),
# never a ref that could move. This fails unless the release tag created by
# release-please points at exactly that commit.
#
# Usage: bash scripts/ci/assert-release-tag.sh <tag>
set -euo pipefail

tag="${1:?usage: assert-release-tag.sh <tag>}"
expected="${GITHUB_SHA:?GITHUB_SHA is not set}"

git fetch --quiet --no-tags --depth=1 origin "refs/tags/${tag}:refs/tags/${tag}"
actual="$(git rev-parse "${tag}^{commit}")"

if [[ "$actual" != "$expected" ]]; then
  echo "::error title=Release tag mismatch::${tag} points at ${actual}, this run built ${expected}."
  exit 1
fi
echo "${tag} -> ${actual} (matches GITHUB_SHA)"
