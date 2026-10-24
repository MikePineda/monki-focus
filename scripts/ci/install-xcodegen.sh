#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Installs XcodeGen from its GitHub release zip, verified against a pinned
# SHA-256 (instead of an unpinned `brew install`), and adds it to the PATH of
# the following GitHub Actions steps. Bump both values together.
#
# Usage: bash scripts/ci/install-xcodegen.sh
set -euo pipefail

version='2.46.0'
sha256='4d9e34b62172d645eed6457cac13fc222569974098ef4ee9c3368bedf0196806' # xcodegen.zip

dest="${RUNNER_TEMP:-$(mktemp -d)}/xcodegen-${version}"
archive="${dest}.zip"

curl -fsSL -o "$archive" "https://github.com/yonaskolb/XcodeGen/releases/download/${version}/xcodegen.zip"
echo "${sha256}  ${archive}" | shasum -a 256 --check --strict
rm -rf "$dest"
mkdir -p "$dest"
unzip -q "$archive" -d "$dest"

# The binary finds its templates in ../share/xcodegen, so keep the layout.
bin_dir="${dest}/xcodegen/bin"
"${bin_dir}/xcodegen" --version
if [[ -n "${GITHUB_PATH:-}" ]]; then
  echo "$bin_dir" >>"$GITHUB_PATH"
else
  echo "add ${bin_dir} to PATH"
fi
