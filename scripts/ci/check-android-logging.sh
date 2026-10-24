#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Accessibility node text must never reach a log (docs/threat-model.md, B4).
# Fails when a Kotlin or Java source under the Android tree calls `Log.*` or
# `Timber.*` with arguments that reference node text: `.text`,
# `contentDescription` or `getText(`.
#
# This is a line-based placeholder: a call split across lines is not caught.
# The release build also strips `android.util.Log` with R8
# `-assumenosideeffects`; a unit test on the accessibility adapter is the
# precise check, this grep is the cheap net that runs on every pull request.
#
# Usage: bash scripts/ci/check-android-logging.sh [android-dir]
# A missing directory is a no-op, so the check passes before the Android app
# exists.
set -euo pipefail

if [[ $# -eq 0 ]]; then
  cd "$(git rev-parse --show-toplevel)"
fi
android_dir="${1:-android}"

if [[ ! -d "$android_dir" ]]; then
  echo "check-android-logging: ${android_dir}/ not found, nothing to check"
  exit 0
fi

log_call='\b(Log|Timber)\.[A-Za-z]+[[:space:]]*\('
node_text='(\.text\b|contentDescription|getText\()'

files=()
while IFS= read -r -d '' file; do
  files+=("$file")
done < <(find "$android_dir" -type f \( -name '*.kt' -o -name '*.kts' -o -name '*.java' \) \
  -not -path '*/build/*' -not -path '*/.gradle/*' -print0)

if [[ ${#files[@]} -eq 0 ]]; then
  echo "check-android-logging: no Kotlin or Java sources under ${android_dir}/"
  exit 0
fi

hits="$(
  printf '%s\0' "${files[@]}" |
    xargs -0 grep -n -H -E -e "${log_call}.*${node_text}" -- 2>/dev/null || true
)"

if [[ -n "$hits" ]]; then
  echo 'check-android-logging: accessibility node text passed to a logger:' >&2
  printf '%s\n' "$hits" >&2
  echo 'Log a reason code or a count instead; never node text.' >&2
  exit 1
fi

echo "check-android-logging: ${#files[@]} files clean"
