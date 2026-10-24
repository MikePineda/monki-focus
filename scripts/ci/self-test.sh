#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Self-test for the CI guard scripts. Runs privacy-check.sh and
# check-android-logging.sh against throwaway git repositories in a temp
# directory, with a synthetic pattern (`zebrafoo`) only: real patterns are
# never needed and never used here. Probe strings are assembled at runtime so
# this file itself passes the generic e-mail and phone checks.
#
# Usage: bash scripts/ci/self-test.sh
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
# The owner handle, derived from the repo URL so it is never spelled out alone.
owner="$(printf '%s' 'github.com/MikePineda/monki-focus' | cut -d/ -f2)"

failures=0
pass() { echo "ok   - $1"; }
fail() {
  echo "FAIL - $1" >&2
  failures=$((failures + 1))
}

# expect <name> <expected-exit> <command...>
# The command's output lands in "$tmp/out" once it has finished, so an
# assertion can grep the output of the previous command.
expect() {
  local name="$1" expected="$2" status=0
  shift 2
  "$@" >"$tmp/out.next" 2>&1 || status=$?
  mv "$tmp/out.next" "$tmp/out"
  if [[ "$status" == "$expected" ]]; then
    pass "$name"
  else
    fail "$name (exit $status, expected $expected)"
    sed 's/^/       /' "$tmp/out" >&2
  fi
}

new_repo() {
  rm -rf "$tmp/repo"
  mkdir -p "$tmp/repo/scripts/ci" "$tmp/repo/.github"
  cp "$script_dir/privacy-check.sh" "$tmp/repo/scripts/ci/"
  printf '* @%s\n' "$owner" >"$tmp/repo/.github/CODEOWNERS"
  printf 'hello\n' >"$tmp/repo/README.md"
  git -C "$tmp/repo" init -q
  git -C "$tmp/repo" add -A
}

privacy() { (cd "$tmp/repo" && bash scripts/ci/privacy-check.sh); }
privacy_with_file() { (cd "$tmp/repo" && PRIVACY_PATTERNS_FILE="$tmp/patterns.txt" bash scripts/ci/privacy-check.sh); }
privacy_with_env() { (cd "$tmp/repo" && PRIVACY_PATTERNS="$(printf '# comment\n\nzebrafoo\n')" bash scripts/ci/privacy-check.sh); }

printf '# synthetic patterns for the self-test\nzebrafoo\n\n' >"$tmp/patterns.txt"
at='@'

# --- privacy-check.sh --------------------------------------------------------
new_repo
expect 'privacy: clean repo passes (generic only)' 0 privacy
expect 'privacy: clean repo passes (pattern file)' 0 privacy_with_file
expect 'privacy: clean repo passes (pattern env)' 0 privacy_with_env

new_repo
printf 'line one\nsee ZebraFoo here\n' >"$tmp/repo/notes.md"
expect 'privacy: pattern from env fails' 1 privacy_with_env
expect 'privacy: pattern in a new file fails' 1 privacy_with_file
cp "$tmp/out" "$tmp/hit-out"
expect 'privacy: hit is reported as file:line' 0 grep -q '^notes.md:2$' "$tmp/hit-out"
expect 'privacy: matched text is never printed' 1 grep -qi 'zebrafoo' "$tmp/hit-out"
expect 'privacy: without patterns the synthetic word passes' 0 privacy

new_repo
printf 'see https://github.com/MikePineda/monki-focus by zebrafoo\n' >"$tmp/repo/notes.md"
expect 'privacy: allowed URL is stripped, rest of the line still checked' 1 privacy_with_file

new_repo
printf 'see https://github.com/MikePineda/monki-focus and ghcr.io/mikepineda/monki-focus-server\n' >"$tmp/repo/notes.md"
expect 'privacy: allowed URLs alone pass' 0 privacy_with_file

new_repo
printf '* @%s zebrafoo\n' "$owner" >"$tmp/repo/.github/CODEOWNERS"
expect 'privacy: CODEOWNERS is scanned after stripping the handle' 1 privacy_with_file

new_repo
: >"$tmp/repo/zebrafoo-notes.txt"
expect 'privacy: pattern in a file path fails' 1 privacy_with_file
expect 'privacy: path hit is reported by number' 0 grep -q '^path #' "$tmp/out"

new_repo
printf 'contact: someone%scorp-mail.test\n' "$at" >"$tmp/repo/notes.md"
expect 'privacy: generic e-mail check fails' 1 privacy

new_repo
printf 'bot: 1+bot%susers.noreply.github.com, demo%sexample.com\n' "$at" "$at" >"$tmp/repo/notes.md"
expect 'privacy: noreply and example e-mails pass' 0 privacy

new_repo
printf 'call %s %s %s %s\n' '+61' '412' '345' '678' >"$tmp/repo/notes.md"
expect 'privacy: generic phone check fails' 1 privacy

new_repo
printf 'version 1.2.3 on 2026-10-25, port 3433\n' >"$tmp/repo/notes.md"
expect 'privacy: versions, dates and ports pass' 0 privacy

new_repo
printf 'zebrafoo(\n' >"$tmp/bad-patterns.txt"
expect 'privacy: invalid pattern fails with exit 2' 2 \
  bash -c "cd '$tmp/repo' && PRIVACY_PATTERNS_FILE='$tmp/bad-patterns.txt' bash scripts/ci/privacy-check.sh"
expect 'privacy: unreadable pattern file fails with exit 2' 2 \
  bash -c "cd '$tmp/repo' && PRIVACY_PATTERNS_FILE='$tmp/missing.txt' bash scripts/ci/privacy-check.sh"

# --- check-android-logging.sh ------------------------------------------------
android="$tmp/android/app/src/main/kotlin"
mkdir -p "$android"
cat >"$android/Clean.kt" <<'EOF'
class Clean {
    fun f(count: Int) {
        Log.d(TAG, "count=$count")
        Timber.i("reason=%s", "blocked")
    }
}
EOF
expect 'logging: clean sources pass' 0 bash "$script_dir/check-android-logging.sh" "$tmp/android"
expect 'logging: missing directory is a no-op' 0 bash "$script_dir/check-android-logging.sh" "$tmp/no-android"
for call in 'Timber.i("node %s", node.text)' 'Log.d(TAG, node.contentDescription.toString())' \
  'android.util.Log.w(TAG, node.getText().toString())'; do
  printf 'class Leaky {\n    fun f() {\n        %s\n    }\n}\n' "$call" >"$android/Leaky.kt"
  expect "logging: fails on ${call%%(*}" 1 bash "$script_dir/check-android-logging.sh" "$tmp/android"
done

if [[ $failures -gt 0 ]]; then
  echo "self-test: ${failures} failure(s)" >&2
  exit 1
fi
echo 'self-test: all checks passed'
