#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Privacy gate for a public repository: fails when a tracked (or new,
# not-ignored) file, or a tracked file path, contains a personal detail.
#
# The personal patterns are never stored in the repository. They come from
# the environment, one extended regex per line (case-insensitive; blank lines
# and lines starting with `#` are ignored):
#   PRIVACY_PATTERNS        multi-line value (CI: the PRIVACY_PATTERNS secret)
#   PRIVACY_PATTERNS_FILE   path to a file (locally: the gitignored
#                           docs/internal/privacy-patterns.txt, see lefthook)
# Without either (fork pull requests, secret not set yet) it prints a warning
# and runs only the generic checks, which always run: e-mail addresses other
# than GitHub noreply and example.com/example.org ones, and phone numbers.
#
# Allowed substrings are stripped from each line before matching, so the rest
# of that line is still checked: the canonical repo and registry URLs (GitHub
# derives them from the owner handle) and, in .github/CODEOWNERS only, the
# owner handle itself.
#
# Only the location of a hit is printed, never the matched text or the
# patterns, so a public CI log does not leak what it found. Any grep error
# (an invalid pattern, an unreadable file) fails the check with exit 2.
#
# Usage: bash scripts/ci/privacy-check.sh   (run from anywhere inside the repo)
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
chmod 700 "$work_dir"
patterns="$work_dir/patterns"

# Personal patterns, if any. Never echo them.
if [[ -n "${PRIVACY_PATTERNS_FILE:-}" && ! -r "${PRIVACY_PATTERNS_FILE}" ]]; then
  echo 'privacy-check: PRIVACY_PATTERNS_FILE is not readable' >&2
  exit 2
fi
{
  if [[ -n "${PRIVACY_PATTERNS_FILE:-}" ]]; then
    cat -- "$PRIVACY_PATTERNS_FILE"
    echo
  fi
  if [[ -n "${PRIVACY_PATTERNS:-}" ]]; then
    printf '%s\n' "$PRIVACY_PATTERNS"
  fi
} | tr -d '\r' | { grep -v -E '^[[:space:]]*(#|$)' || true; } >"$patterns"

personal_count="$(wc -l <"$patterns" | tr -d ' ')"
if [[ "$personal_count" -eq 0 ]]; then
  echo '::warning title=privacy-check::No personal patterns (PRIVACY_PATTERNS / PRIVACY_PATTERNS_FILE); running the generic e-mail and phone checks only.'
fi

# Generic checks, matched after the allowed e-mail domains are stripped.
cat >>"$patterns" <<'EOF'
[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}
\+[0-9]{1,3}[ .-][0-9]{1,4}([ .-][0-9]{2,4}){2,3}\b
\(?\b[0-9]{3}\)?[ .-][0-9]{3}[ .-][0-9]{4}\b
EOF

# Allowed substrings, written out literally so they are stripped from this
# file too. Matching is case-insensitive, so every line is lowercased first.
allowed=(
  'github.com/MikePineda/monki-focus'
  'ghcr.io/mikepineda/monki-focus'
  '@users.noreply.github.com'
  '@example.com'
  '@example.org'
)
sed_args=()
for literal in "${allowed[@]}"; do
  lowered="$(printf '%s' "$literal" | tr '[:upper:]' '[:lower:]')"
  sed_args+=(-e "s#${lowered//./\\.}##g")
done
# The owner handle, derived from the repo URL so it is never spelled out alone.
codeowners_handle="@$(printf '%s' 'github.com/MikePineda/monki-focus' | cut -d/ -f2 | tr '[:upper:]' '[:lower:]')"

# Runs the patterns over stdin and writes the matching line numbers to
# "$work_dir/lines". Exits 2 on a grep error.
match_lines() {
  local status=0
  grep -n -i -E -f "$patterns" >"$work_dir/matched" || status=$?
  if [[ $status -gt 1 ]]; then
    echo 'privacy-check: grep failed (invalid pattern or unreadable input)' >&2
    exit 2
  fi
  cut -d: -f1 <"$work_dir/matched" >"$work_dir/lines"
}

hits="$work_dir/hits"
: >"$hits"

files=()
while IFS= read -r -d '' file; do
  files+=("$file")
done < <(git ls-files -z --cached --others --exclude-standard)

# 1. File paths: line N of the list is path N.
printf '%s\n' "${files[@]}" | tr '[:upper:]' '[:lower:]' | sed "${sed_args[@]}" >"$work_dir/paths"
match_lines <"$work_dir/paths"
while IFS= read -r number; do
  echo "path #${number} (git ls-files --cached --others --exclude-standard | sed -n ${number}p)" >>"$hits"
done <"$work_dir/lines"

# 2. File contents (text files only; deleted files are skipped).
scanned=0
for file in "${files[@]}"; do
  [[ -f "$file" ]] || continue
  status=0
  grep -I -q '' -- "$file" || status=$?
  if [[ $status -eq 1 ]]; then
    continue # binary or empty
  elif [[ $status -gt 1 ]]; then
    echo "privacy-check: cannot read ${file}" >&2
    exit 2
  fi
  scanned=$((scanned + 1))
  file_sed_args=("${sed_args[@]}")
  if [[ "$file" == '.github/CODEOWNERS' ]]; then
    file_sed_args+=(-e "s#${codeowners_handle}##g")
  fi
  tr '[:upper:]' '[:lower:]' <"$file" | sed "${file_sed_args[@]}" >"$work_dir/content"
  match_lines <"$work_dir/content"
  while IFS= read -r number; do
    echo "${file}:${number}" >>"$hits"
  done <"$work_dir/lines"
done

if [[ -s "$hits" ]]; then
  echo 'privacy-check: personal details found (location only, text withheld):' >&2
  sort -u "$hits" >&2
  echo 'Replace them with roles ("the user", "the guardian", "the maintainer").' >&2
  exit 1
fi

echo "privacy-check: ${#files[@]} paths and ${scanned} files clean (${personal_count} personal patterns + generic checks)"
