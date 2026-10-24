#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Privacy gate for a public repository: fails when a tracked (or new,
# not-ignored) file contains a personal detail of the maintainers.
#
# The patterns are stored base64-encoded so that this script never matches
# itself and does not publish the very strings it guards against. They are
# decoded at runtime and combined into one case-insensitive extended regex.
#
# Allowed exceptions, by design and nothing else:
#   - .github/CODEOWNERS (GitHub needs the owner handle there);
#   - lines that contain the canonical repo or registry URL, which GitHub
#     derives from the owner handle.
#
# Only `file:line` is printed for each hit, never the matched text, so the CI
# log of a public repo does not leak what it found.
#
# Usage: bash scripts/ci/privacy-check.sh   (run from anywhere inside the repo)
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

encoded_patterns=(
  bWlndWVs
  cGFtZWxh
  XGJwYW1cYg==
  YnJpc2JhbmU=
  QGdtYWls
  c3RhZ2VzbGVhcm5pbmc=
  cGluZWRh
  XGJtaWtlXGI=
)

regex=''
for encoded in "${encoded_patterns[@]}"; do
  decoded="$(printf '%s' "$encoded" | base64 --decode)"
  regex="${regex:+${regex}|}${decoded}"
done

allowed_repo_url='github.com/MikePineda/monki-focus'
allowed_registry_url='ghcr.io/mikepineda/monki-focus'

# Tracked files plus new files that are not ignored, so the check also covers
# work that is about to be committed. Files deleted from the working tree are
# skipped.
files=()
while IFS= read -r -d '' file; do
  [[ -f "$file" ]] && files+=("$file")
done < <(git ls-files -z --cached --others --exclude-standard -- . ':(exclude).github/CODEOWNERS')

if [[ ${#files[@]} -eq 0 ]]; then
  echo 'privacy-check: no files to scan'
  exit 0
fi

hits="$(
  printf '%s\0' "${files[@]}" |
    xargs -0 grep -n -H -I -i -E -e "$regex" -- 2>/dev/null |
    grep -v -i -F -e "$allowed_repo_url" -e "$allowed_registry_url" |
    cut -d: -f1,2 || true
)"

if [[ -n "$hits" ]]; then
  echo 'privacy-check: personal details found (file:line, text withheld):' >&2
  printf '%s\n' "$hits" | sort -u >&2
  echo 'Replace them with roles ("the user", "the guardian", "the maintainer").' >&2
  exit 1
fi

echo "privacy-check: ${#files[@]} files clean"
