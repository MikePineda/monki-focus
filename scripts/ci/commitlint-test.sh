#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Specification of the commitlint configs: commitlint.config.mjs lints commits,
# commitlint.title.config.mjs lints pull request titles and
# commitlint.dependabot.config.mjs lints Dependabot's titles. A case that
# expects a rejection also names the rule that must reject it, so a config that
# fails to load never counts as a correct rejection. Needs node_modules.
#
# Usage: bash scripts/ci/commitlint-test.sh
set -uo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/../.." || exit 2

base=commitlint.config.mjs
title=commitlint.title.config.mjs
dependabot=commitlint.dependabot.config.mjs

failures=0
pass() { echo "ok   - $1"; }
fail() {
  echo "FAIL - $1" >&2
  failures=$((failures + 1))
}

# Sets `output` and `status` from linting the message under the config.
lint() {
  status=0
  output="$(printf '%s\n' "$2" | npx --no-install commitlint --config "$1" --verbose 2>&1)" || status=$?
}

# passes <name> <config> <message>
passes() {
  lint "$2" "$3"
  if [[ "$status" == 0 ]]; then
    pass "$1"
  else
    fail "$1 (exit $status, expected 0)"
    printf '%s\n' "$output" | sed 's/^/       /' >&2
  fi
}

# rejects <name> <config> <rule> <message>
rejects() {
  lint "$2" "$4"
  if [[ "$status" == 1 && "$output" == *"[$3]"* ]]; then
    pass "$1"
  else
    fail "$1 (exit $status, expected 1 from rule $3)"
    printf '%s\n' "$output" | sed 's/^/       /' >&2
  fi
}

passes dependabot_title_with_capital_bump_passes "$dependabot" \
  'build(deps): Bump the tooling group across 1 directory with 4 updates'
passes dependabot_dev_dependency_scope_passes "$dependabot" \
  'build(deps-dev): Bump wxt from 0.21.4 to 0.21.5 in the extension group'
passes dependabot_chore_prefix_for_dev_dependencies_passes "$dependabot" \
  'chore(deps-dev): Bump wxt from 0.21.4 to 0.21.5 in the extension group'
passes dependabot_actions_title_passes "$dependabot" \
  'ci(deps): Bump the actions group with 3 updates'
rejects dependabot_title_with_unknown_scope_fails "$dependabot" scope-enum \
  'build(deps-prod): Bump wxt from 0.21.4 to 0.21.5'
rejects dependabot_title_without_a_type_fails "$dependabot" type-empty \
  'Bump wxt from 0.21.4 to 0.21.5'

passes human_title_needs_no_trailer "$title" \
  'feat(extension): add a focus timer'
passes human_title_may_use_the_dev_dependency_scope "$title" \
  'chore(deps-dev): update the test tooling'
rejects human_title_with_sentence_case_fails "$title" subject-case \
  'feat(extension): Add a focus timer'
rejects human_title_with_unknown_scope_fails "$title" scope-enum \
  'feat(billing): add a focus timer'

signed_commit="$(printf 'feat(extension): add a focus timer\n\nSigned-off-by: The User <user@example.com>')"
passes commit_with_signoff_passes_under_the_base_config "$base" "$signed_commit"
rejects commit_without_signoff_still_fails_under_the_base_config "$base" trailer-exists \
  'feat(extension): add a focus timer'

if [[ $failures -gt 0 ]]; then
  echo "commitlint-test: ${failures} failure(s)" >&2
  exit 1
fi
echo 'commitlint-test: all checks passed'
