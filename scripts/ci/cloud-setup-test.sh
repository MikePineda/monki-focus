#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Specification of scripts/cloud-setup.sh. Every case builds a throwaway world:
# a fake repo, a fake HOME and fake npm, npx, docker, service, su and friends
# on PATH that record their arguments and fail on demand. The script runs under
# `env -i`, so nothing leaks in from the caller: no network, no real Docker
# daemon, no real ~/.gradle. Runs on macOS and Ubuntu (bash 3.2 safe).
#
# Usage: bash scripts/ci/cloud-setup-test.sh
set -uo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
setup_script="$script_dir/../cloud-setup.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Synthetic proxy credentials: the leak probes look for these exact strings. The
# URLs are assembled at runtime so this file passes the generic e-mail check.
at='@'
proxy_user='synth%40user'
proxy_pass='s3cr%2Ft'
proxy_url="http://$proxy_user:$proxy_pass${at}proxy.example.com:3128"
mirror_host='maven-central.storage-download.googleapis.com'

failures=0
spec_failed=0

# --- fake commands -------------------------------------------------------------
write_fake_command() {
  cat >"$1" <<'EOF'
#!/bin/bash
# Records the call, then behaves per the FAKE_* knobs and the files in FAKE_STATE.
name="${0##*/}"
state="$FAKE_STATE"
printf '%s\n' "$name${*:+ $*}" >>"$state/calls"
fails_if() { if [ -n "${1:-}" ]; then exit 1; fi; }
leak_probe() { if [ -n "${FAKE_TOOLS_ECHO_PROXY:-}" ]; then echo "$name via ${HTTPS_PROXY:-}"; fi; }

case "$name" in
npm)
  leak_probe
  case "${1:-}" in
  --version) echo "${FAKE_NPM_VERSION:-11.19.0}" ;;
  ci)
    printf 'npm-ci-env CI=%s\n' "${CI:-unset}" >>"$state/calls"
    fails_if "${FAKE_ALL_FAIL:-}${FAKE_NPM_CI_FAIL:-}"
    # npm ci deletes node_modules, so a hash written earlier would not survive.
    rm -rf node_modules
    mkdir -p node_modules
    ;;
  rebuild) fails_if "${FAKE_ALL_FAIL:-}${FAKE_NPM_REBUILD_FAIL:-}" ;;
  esac
  ;;
npx)
  printf 'npx-cwd %s %s\n' "${PWD##*/}" "$*" >>"$state/calls"
  case "$*" in
  *playwright*) fails_if "${FAKE_ALL_FAIL:-}${FAKE_PLAYWRIGHT_FAIL:-}" ;;
  *lefthook*)
    fails_if "${FAKE_ALL_FAIL:-}${FAKE_LEFTHOOK_FAIL:-}"
    mkdir -p .git/hooks
    : >.git/hooks/pre-push
    ;;
  esac
  ;;
docker)
  case "${1:-}" in
  info) [ -f "$state/docker-up" ] || exit 1 ;;
  compose)
    leak_probe
    case "$*" in
    *" up "*) fails_if "${FAKE_ALL_FAIL:-}${FAKE_COMPOSE_FAIL:-}" ;;
    esac
    ;;
  esac
  ;;
dockerd)
  fails_if "${FAKE_ALL_FAIL:-}${FAKE_DOCKERD_FAIL:-}"
  : >"$state/docker-up"
  ;;
service)
  case "${1:-} ${2:-}" in
  'docker start')
    if [ -n "${FAKE_SERVICE_SPAWNS_DAEMON:-}" ]; then
      /bin/sleep 5 &
    fi
    [ -f "$state/docker-service-works" ] || exit 1
    : >"$state/docker-up"
    ;;
  'postgresql start')
    fails_if "${FAKE_ALL_FAIL:-}${FAKE_POSTGRES_FAIL:-}"
    [ -f "$state/pg-running" ] || cp "$state/pg-configured-port" "$state/pg-running"
    ;;
  'postgresql restart')
    fails_if "${FAKE_ALL_FAIL:-}${FAKE_POSTGRES_FAIL:-}"
    cp "$state/pg-configured-port" "$state/pg-running"
    ;;
  esac
  ;;
su | sudo)
  # The privileged psql call: the SQL arrives on stdin, the port in the command.
  sql="$(cat)"
  printf 'psql-stdin %s\n' "$sql" >>"$state/calls"
  fails_if "${FAKE_ALL_FAIL:-}${FAKE_POSTGRES_FAIL:-}"
  [ -f "$state/pg-running" ] || exit 2
  case "$*" in
  *"-p $(cat "$state/pg-running")"*) ;;
  *) exit 2 ;;
  esac
  port="$(printf '%s\n' "$sql" | sed -n 's/.*ALTER SYSTEM SET port = \([0-9]*\).*/\1/p')"
  if [ -n "$port" ]; then
    printf '%s\n' "$port" >"$state/pg-configured-port"
  fi
  ;;
timeout)
  shift
  exec "$@"
  ;;
sleep)
  # Short real pause: enough for a backgrounded fake daemon to come up.
  /bin/sleep 0.05
  ;;
curl)
  fails_if "${FAKE_ALL_FAIL:-}"
  case "$*" in
  *file://*) exec /usr/bin/curl "$@" ;;
  *storage-download.googleapis.com*)
    leak_probe
    [ -n "${FAKE_MIRROR_UP:-}" ] || exit 7
    ;;
  *) exit 7 ;;
  esac
  ;;
node)
  echo "${FAKE_PATH_NODE:-v22.1.0}"
  ;;
esac
exit 0
EOF
  chmod +x "$1"
}

# --- world ---------------------------------------------------------------------
new_world() {
  world="$tmp/world"
  rm -rf "$world"
  repo="$world/repo"
  home="$world/home"
  state="$world/state"
  fake="$world/fake"
  node_root="$world/node-root"
  env_file="$world/claude.env"
  log="$world/tmp/cloud-setup.log"
  stdout="$world/stdout"
  stderr="$world/stderr"
  hash_file="$repo/node_modules/.cloud-setup.sha256"
  gradle_props="$home/.gradle/gradle.properties"
  jvm_options="$home/.gradle/cloud-setup-jvm.options"
  init_script="$home/.gradle/init.d/cloud-maven-mirror.gradle"
  mkdir -p "$repo/packages/a" "$repo/extension" "$repo/server/api" \
    "$home" "$state" "$fake" "$world/tmp" "$world/dist"

  write_fake_command "$fake/npm"
  local command
  for command in npx docker dockerd service su sudo timeout sleep curl node; do
    ln -s npm "$fake/$command"
  done
  # shellcheck disable=SC2016
  if ! PATH=/usr/bin:/bin:/usr/sbin:/sbin command -v sha256sum >/dev/null 2>&1; then
    printf '#!/bin/bash\nexec shasum -a 256 "$@"\n' >"$fake/sha256sum"
    chmod +x "$fake/sha256sum"
  fi

  # Node 24 is preinstalled unless a spec removes it, and Docker is up.
  mkdir -p "$node_root/node24/bin"
  printf '#!/bin/bash\necho v24.0.0\n' >"$node_root/node24/bin/node"
  chmod +x "$node_root/node24/bin/node"
  : >"$state/docker-up"
  echo 5432 >"$state/pg-configured-port"

  echo 24 >"$repo/.nvmrc"
  echo '{"name":"root"}' >"$repo/package.json"
  echo '{"lockfileVersion":3}' >"$repo/package-lock.json"
  echo '{"name":"a"}' >"$repo/packages/a/package.json"
  echo '{"name":"extension"}' >"$repo/extension/package.json"
  echo 'services: {}' >"$repo/docker-compose.test.yml"
  write_env_test
  git -C "$repo" init -q
  git -C "$repo" add -A
}

write_env_test() {
  cat >"$repo/server/api/.env.test" <<'EOF'
# synthetic test values
DB_HOST=127.0.0.1
DB_PORT=5998
DB_USER=synthuser
DB_PASSWORD=synth'secret
DB_DATABASE=synthdb
EOF
}

# run_setup [KEY=VALUE...]: runs the script in the world; later values win.
run_setup_command() {
  env -i HOME="$home" PATH="$fake:/usr/bin:/bin:/usr/sbin:/sbin" TMPDIR="$world/tmp" \
    CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR="$repo" CLAUDE_ENV_FILE="$env_file" \
    CLOUD_SETUP_NODE_ROOT="$node_root" CLOUD_SETUP_NODE_DIST="file://$world/dist" \
    CLOUD_SETUP_ANDROID_SDK="$world/no-android-sdk" FAKE_STATE="$state" \
    "$@" bash "$setup_script"
}

run_setup() {
  status=0
  run_setup_command "$@" >"$stdout" 2>"$stderr" || status=$?
}

forget_calls() { rm -f "$state/calls"; }

# Builds a fake Node tarball and its checksums, the way nodejs.org lays them out.
publish_node_dist() {
  local version_dir="$world/dist/latest-v24.x" build="$world/build/node-v24.9.9-linux-x64"
  mkdir -p "$version_dir" "$build/bin"
  printf '#!/bin/bash\necho v24.9.9\n' >"$build/bin/node"
  chmod +x "$build/bin/node"
  (cd "$world/build" && COPYFILE_DISABLE=1 tar -cJf "$version_dir/node-v24.9.9-linux-x64.tar.xz" node-v24.9.9-linux-x64)
  (
    cd "$version_dir" || exit 1
    {
      echo "0000000000000000000000000000000000000000000000000000000000000000  node-v24.9.9-linux-arm64.tar.xz"
      PATH="$fake:$PATH" sha256sum node-v24.9.9-linux-x64.tar.xz
    } >SHASUMS256.txt
  )
}

# --- assertions ----------------------------------------------------------------
complain() {
  echo "       $1" >&2
  spec_failed=1
}
expect_exit_zero() { [[ "$status" == 0 ]] || complain "exit status was $status"; }
called() { grep -qxF -- "$1" "$state/calls" 2>/dev/null || complain "expected call: $1"; }
never_called() { if grep -qF -- "$1" "$state/calls" 2>/dev/null; then complain "unexpected call: $1"; fi; }
call_count() {
  local count
  count="$(grep -cF -- "$1" "$state/calls" 2>/dev/null)"
  [[ "${count:-0}" == "$2" ]] || complain "expected $2 of '$1', saw ${count:-0}"
}
has() { grep -qF -- "$2" "$1" 2>/dev/null || complain "expected '$2' in ${1##*/}"; }
lacks() { if grep -qF -- "$2" "$1" 2>/dev/null; then complain "unexpected '$2' in ${1##*/}"; fi; }
is_file() { [[ -f "$1" ]] || complain "expected file ${1##*/}"; }
is_absent() { [[ ! -e "$1" ]] || complain "expected no ${1##*/}"; }
is_private() {
  local mode
  # shellcheck disable=SC2012 # stat flags differ between macOS and Ubuntu.
  mode="$(ls -l "$1" 2>/dev/null | cut -c1-10)"
  [[ "$mode" == '-rw-------' ]] || complain "expected mode 600 on ${1##*/}, saw '$mode'"
}

spec() {
  spec_failed=0
  new_world
  "$1"
  if [[ "$spec_failed" == 0 ]]; then
    echo "ok   - cloud setup: $1"
  else
    echo "FAIL - cloud setup: $1" >&2
    failures=$((failures + 1))
  fi
}

# --- the gate ------------------------------------------------------------------
exits_immediately_outside_the_cloud() {
  local value
  for value in '' false 1 TRUE; do
    run_setup CLAUDE_CODE_REMOTE="$value" HTTPS_PROXY="$proxy_url" FAKE_MIRROR_UP=1
    expect_exit_zero
    [[ ! -s "$stdout" ]] || complain "printed something with CLAUDE_CODE_REMOTE='$value'"
    [[ ! -s "$stderr" ]] || complain "wrote to stderr with CLAUDE_CODE_REMOTE='$value'"
  done
  is_absent "$state/calls"
  is_absent "$log"
  is_absent "$env_file"
  is_absent "$home/.gradle"
  is_absent "$repo/node_modules"
  [[ -z "$(ls -A "$world/tmp")" ]] || complain 'left files in the temp directory'
}

# --- node ----------------------------------------------------------------------
uses_the_preinstalled_node_when_present() {
  run_setup
  expect_exit_zero
  never_called 'SHASUMS256.txt'
  has "$env_file" "export PATH=\"$node_root/node24/bin:\$PATH\""
  has "$stdout" 'v24.0.0'
  has "$stdout" "$node_root/node24/bin/node"
}

uses_the_node_on_path_when_it_has_the_wanted_major() {
  rm -rf "$node_root/node24"
  run_setup FAKE_PATH_NODE=v24.1.0
  expect_exit_zero
  never_called 'SHASUMS256.txt'
  is_absent "$node_root/node24"
  has "$stdout" 'v24.1.0'
}

downloads_and_verifies_node_when_it_is_missing() {
  rm -rf "$node_root/node24"
  publish_node_dist
  run_setup
  expect_exit_zero
  is_file "$node_root/node24/bin/node"
  has "$stdout" 'v24.9.9'
  has "$env_file" "export PATH=\"$node_root/node24/bin:\$PATH\""
  [[ "$(ls -A "$node_root")" == 'node24' ]] || complain 'left work files in the install root'
}

leaves_no_node_dir_when_the_checksum_fails() {
  rm -rf "$node_root/node24"
  publish_node_dist
  echo "1111111111111111111111111111111111111111111111111111111111111111  node-v24.9.9-linux-x64.tar.xz" \
    >"$world/dist/latest-v24.x/SHASUMS256.txt"
  run_setup
  expect_exit_zero
  is_absent "$node_root/node24"
  [[ -z "$(ls -A "$node_root")" ]] || complain 'left work files in the install root'
  has "$stdout" 'node: FAILED'
}

# --- dependencies --------------------------------------------------------------
installs_on_the_first_run_and_records_the_hash() {
  run_setup
  expect_exit_zero
  called 'npm ci --ignore-scripts'
  is_file "$hash_file"
  has "$stdout" 'dependencies: installed'
}

skips_install_when_lockfiles_are_unchanged() {
  run_setup
  forget_calls
  run_setup
  expect_exit_zero
  never_called 'npm ci'
  never_called 'npx'
  has "$stdout" 'dependencies: up to date'
}

reinstalls_when_a_workspace_manifest_changes() {
  run_setup
  forget_calls
  echo '{"name":"a","version":"2.0.0"}' >"$repo/packages/a/package.json"
  run_setup
  called 'npm ci --ignore-scripts'
}

reinstalls_when_the_lockfile_changes() {
  run_setup
  forget_calls
  echo '{"lockfileVersion":3,"changed":true}' >"$repo/package-lock.json"
  run_setup
  called 'npm ci --ignore-scripts'
}

reinstalls_when_the_node_version_changes() {
  run_setup
  forget_calls
  echo '24.1.0' >"$repo/.nvmrc"
  run_setup
  called 'npm ci --ignore-scripts'
}

reinstalls_when_a_workspace_is_added() {
  run_setup
  forget_calls
  mkdir -p "$repo/packages/b"
  # Same content as an existing manifest: only the file list differs.
  cp "$repo/packages/a/package.json" "$repo/packages/b/package.json"
  git -C "$repo" add -A
  run_setup
  called 'npm ci --ignore-scripts'
}

reinstalls_when_an_npmrc_appears() {
  run_setup
  forget_calls
  echo 'audit=false' >"$repo/.npmrc"
  run_setup
  called 'npm ci --ignore-scripts'
}

retries_after_a_failed_install() {
  run_setup FAKE_NPM_CI_FAIL=1
  expect_exit_zero
  is_absent "$hash_file"
  has "$stdout" 'dependencies: FAILED'
  never_called 'npx'
  forget_calls
  run_setup
  called 'npm ci --ignore-scripts'
  is_file "$hash_file"
}

retries_after_a_failed_rebuild() {
  run_setup FAKE_NPM_REBUILD_FAIL=1
  expect_exit_zero
  is_absent "$hash_file"
  has "$stdout" 'dependencies: FAILED'
  forget_calls
  run_setup
  called 'npm ci --ignore-scripts'
}

a_failed_reinstall_discards_the_old_hash() {
  run_setup
  echo '{"lockfileVersion":3,"changed":true}' >"$repo/package-lock.json"
  is_file "$hash_file"
  run_setup FAKE_NPM_CI_FAIL=1
  is_absent "$hash_file"
}

uses_ci_install_policy_and_never_npm_install() {
  run_setup
  called 'npm ci --ignore-scripts'
  called 'npm rebuild --strict-allow-scripts'
  never_called 'npm install'
  never_called 'npm i '
  called 'npm-ci-env CI=unset'
  local ci_line rebuild_line
  ci_line="$(grep -nF 'npm ci --ignore-scripts' "$state/calls" | cut -d: -f1)"
  rebuild_line="$(grep -nF 'npm rebuild --strict-allow-scripts' "$state/calls" | cut -d: -f1)"
  [[ "$ci_line" -lt "$rebuild_line" ]] || complain 'rebuild must follow npm ci'
}

refuses_to_install_with_an_npm_too_old_for_the_scripts_policy() {
  run_setup FAKE_NPM_VERSION=10.9.0
  expect_exit_zero
  never_called 'npm ci'
  never_called 'npm rebuild'
  has "$stdout" 'dependencies: FAILED'
}

does_not_install_when_node_is_unavailable() {
  rm -rf "$node_root/node24"
  run_setup
  expect_exit_zero
  never_called 'npm ci'
  has "$stdout" 'dependencies: FAILED'
}

installs_git_hooks_and_the_browser_after_a_successful_install() {
  run_setup
  called "npx-cwd repo --no-install lefthook install"
  called "npx-cwd extension --no-install playwright install chromium"
}

a_failed_git_hook_install_is_reported_and_retried() {
  run_setup FAKE_LEFTHOOK_FAIL=1
  expect_exit_zero
  has "$stdout" 'dependencies: installed'
  has "$stdout" 'git hooks: FAILED'
  forget_calls
  run_setup
  never_called 'npm ci'
  called "npx-cwd repo --no-install lefthook install"
  has "$stdout" 'git hooks: installed'
}

a_failed_browser_download_does_not_fail_the_install() {
  run_setup FAKE_PLAYWRIGHT_FAIL=1
  expect_exit_zero
  is_file "$hash_file"
  has "$stdout" 'dependencies: installed'
}

# --- services ------------------------------------------------------------------
starts_the_test_services_with_docker_compose() {
  run_setup
  expect_exit_zero
  called 'timeout 120 docker compose -f docker-compose.test.yml up -d --wait'
  called 'docker compose -f docker-compose.test.yml up -d --wait'
  never_called 'service postgresql'
  has "$stdout" 'services: docker (db + ntfy)'
}

starts_the_docker_service_when_the_daemon_is_down() {
  rm "$state/docker-up"
  : >"$state/docker-service-works"
  run_setup
  called 'service docker start'
  never_called 'dockerd'
  called 'docker compose -f docker-compose.test.yml up -d --wait'
}

starts_dockerd_when_the_docker_service_cannot() {
  rm "$state/docker-up"
  run_setup
  called 'service docker start'
  called 'dockerd'
  called 'docker compose -f docker-compose.test.yml up -d --wait'
}

a_daemon_started_by_a_step_does_not_hold_the_hook_open() {
  rm "$state/docker-up"
  : >"$state/docker-service-works"
  local started elapsed
  started="$(date +%s)"
  run_setup_command FAKE_SERVICE_SPAWNS_DAEMON=1 2>&1 | cat >"$stdout"
  elapsed=$(($(date +%s) - started))
  [[ "$elapsed" -lt 4 ]] || complain "hook stayed open for ${elapsed}s behind a daemon"
  has "$stdout" 'services: docker (db + ntfy)'
}

falls_back_to_native_postgres_when_docker_fails() {
  run_setup FAKE_COMPOSE_FAIL=1
  expect_exit_zero
  called 'docker compose -f docker-compose.test.yml down -v'
  called 'service postgresql start'
  called 'service postgresql restart'
  has "$stdout" 'services: native postgres'
  has "$stdout" 'ntfy missing'
  lacks "$stdout" 'FAILED'
}

falls_back_to_native_postgres_when_docker_will_not_start() {
  rm "$state/docker-up"
  run_setup FAKE_DOCKERD_FAIL=1
  expect_exit_zero
  never_called 'docker compose'
  called 'service postgresql start'
  has "$stdout" 'services: native postgres'
}

reads_database_values_from_env_test() {
  run_setup FAKE_COMPOSE_FAIL=1
  has "$state/calls" 'ALTER SYSTEM SET port = 5998'
  has "$state/calls" "'synthuser'"
  has "$state/calls" "'synth''secret'"
  has "$state/calls" "'synthdb'"
  has "$state/calls" 'CREATEDB'
  has "$state/calls" 'CREATE EXTENSION IF NOT EXISTS citext'
  lacks "$state/calls" 'monkifocus'
  lacks "$log" "synth'secret"
  lacks "$stdout" "synth'secret"
}

native_postgres_setup_is_idempotent_on_resume() {
  run_setup FAKE_COMPOSE_FAIL=1
  run_setup FAKE_COMPOSE_FAIL=1
  expect_exit_zero
  call_count 'service postgresql restart' 1
  call_count 'ALTER SYSTEM SET port' 1
  has "$stdout" 'services: native postgres'
}

reports_failed_services_when_the_fallback_fails_too() {
  run_setup FAKE_COMPOSE_FAIL=1 FAKE_POSTGRES_FAIL=1
  expect_exit_zero
  has "$stdout" 'services: FAILED'
}

# --- environment ---------------------------------------------------------------
env_file_lines_are_not_duplicated_on_resume() {
  echo 'export ALREADY_THERE=1' >"$env_file"
  run_setup HTTPS_PROXY="$proxy_url"
  run_setup HTTPS_PROXY="$proxy_url"
  [[ -z "$(sort "$env_file" | uniq -d)" ]] || complain 'duplicated lines in the env file'
  has "$env_file" 'export ALREADY_THERE=1'
  has "$env_file" 'export TURBO_TELEMETRY_DISABLED=1'
  has "$env_file" 'export NODE_OPTIONS=--max-old-space-size=4096'
  lacks "$env_file" 'ANDROID_HOME'
}

exports_the_android_sdk_when_present() {
  local sdk="$world/android-sdk"
  mkdir -p "$sdk"
  run_setup CLOUD_SETUP_ANDROID_SDK="$sdk"
  has "$env_file" "export ANDROID_HOME=$sdk"
  has "$env_file" "$sdk/cmdline-tools/latest/bin"
  has "$env_file" "$sdk/platform-tools"
  has "$stdout" 'android sdk: present'
}

reports_a_missing_android_sdk() {
  run_setup
  has "$stdout" 'android sdk: absent'
}

survives_a_missing_env_file_variable() {
  run_setup CLAUDE_ENV_FILE=
  expect_exit_zero
  is_absent "$env_file"
  has "$stdout" 'dependencies: installed'
}

env_file_is_valid_shell() {
  run_setup HTTPS_PROXY="$proxy_url"
  bash -c '. "$1"' _ "$env_file" 2>"$world/source-errors" || complain 'env file does not source'
  [[ ! -s "$world/source-errors" ]] || complain 'env file printed errors when sourced'
}

# --- jvm proxy -----------------------------------------------------------------
writes_proxy_to_gradle_properties_idempotently() {
  mkdir -p "$home/.gradle"
  echo 'org.gradle.daemon=false' >"$gradle_props"
  run_setup HTTPS_PROXY="$proxy_url"
  run_setup HTTPS_PROXY="$proxy_url"
  expect_exit_zero
  has "$gradle_props" 'org.gradle.daemon=false'
  has "$gradle_props" 'systemProp.https.proxyHost=proxy.example.com'
  has "$gradle_props" 'systemProp.https.proxyPort=3128'
  has "$gradle_props" 'systemProp.https.proxyUser=synth@user'
  has "$gradle_props" 'systemProp.https.proxyPassword=s3cr/t'
  has "$gradle_props" 'systemProp.http.proxyHost=proxy.example.com'
  has "$gradle_props" 'systemProp.http.proxyPort=3128'
  has "$gradle_props" 'systemProp.http.proxyUser=synth@user'
  has "$gradle_props" 'systemProp.http.proxyPassword=s3cr/t'
  has "$gradle_props" 'systemProp.jdk.http.auth.tunneling.disabledSchemes='
  has "$gradle_props" 'systemProp.http.nonProxyHosts=localhost|127.0.0.1'
  [[ "$(grep -c 'systemProp.https.proxyHost' "$gradle_props")" == 1 ]] || complain 'proxy block duplicated'
  is_private "$gradle_props"
}

replaces_the_proxy_block_when_the_proxy_changes() {
  run_setup HTTPS_PROXY="$proxy_url"
  run_setup HTTPS_PROXY='http://other.example.com:8080'
  has "$gradle_props" 'systemProp.https.proxyHost=other.example.com'
  lacks "$gradle_props" 'proxy.example.com'
  lacks "$gradle_props" 'proxyPassword'
  lacks "$jvm_options" 's3cr'
}

reads_a_lowercase_proxy_without_a_scheme_or_credentials() {
  run_setup https_proxy='proxy.example.com:8080'
  has "$gradle_props" 'systemProp.https.proxyHost=proxy.example.com'
  has "$gradle_props" 'systemProp.https.proxyPort=8080'
  lacks "$gradle_props" 'proxyUser'
}

escapes_backslashes_for_the_properties_format() {
  run_setup HTTPS_PROXY="http://user:back%5Cslash${at}proxy.example.com:3128"
  has "$gradle_props" 'systemProp.https.proxyPassword=back\\slash'
}

writes_nothing_for_the_jvm_without_a_proxy_or_a_mirror() {
  run_setup
  is_absent "$home/.gradle"
  lacks "$env_file" 'JAVA_TOOL_OPTIONS'
}

jvm_flags_reach_test_jvms_from_a_private_file() {
  run_setup HTTPS_PROXY="$proxy_url"
  has "$env_file" "export JAVA_TOOL_OPTIONS='-XX:VMOptionsFile=$jvm_options'"
  has "$jvm_options" '-Dhttps.proxyHost="proxy.example.com"'
  has "$jvm_options" '-Dhttp.proxyPort="3128"'
  has "$jvm_options" '-Dhttps.proxyUser="synth@user"'
  has "$jvm_options" '-Dhttps.proxyPassword="s3cr/t"'
  has "$jvm_options" '-Djdk.http.auth.tunneling.disabledSchemes=""'
  has "$jvm_options" '-Dhttp.nonProxyHosts="localhost|127.0.0.1"'
  is_private "$jvm_options"
}

# The JVM echoes JAVA_TOOL_OPTIONS to stderr on every start, so a password there
# would land in the output of every later Gradle run.
java_tool_options_never_carries_credentials() {
  run_setup HTTPS_PROXY="$proxy_url"
  lacks "$env_file" 's3cr'
  lacks "$env_file" 'synth@user'
  lacks "$env_file" 'proxyPassword'
}

keeps_existing_java_tool_options() {
  run_setup HTTPS_PROXY="$proxy_url" JAVA_TOOL_OPTIONS='-Xmx1g'
  has "$env_file" "export JAVA_TOOL_OPTIONS='-Xmx1g -XX:VMOptionsFile=$jvm_options'"
}

never_prints_proxy_credentials() {
  run_setup HTTPS_PROXY="$proxy_url" FAKE_TOOLS_ECHO_PROXY=1
  expect_exit_zero
  has "$log" 'npm via http://***@proxy.example.com:3128'
  local secret file
  for file in "$stdout" "$stderr" "$log"; do
    for secret in "$proxy_pass" "$proxy_user" 's3cr/t' 'synth@user'; do
      lacks "$file" "$secret"
    done
  done
}

never_prints_a_proxy_password_with_a_raw_at_sign() {
  run_setup HTTPS_PROXY="http://user:pa${at}ss${at}proxy.example.com:3128" FAKE_TOOLS_ECHO_PROXY=1
  has "$gradle_props" 'systemProp.https.proxyPassword=pa@ss'
  has "$gradle_props" 'systemProp.https.proxyHost=proxy.example.com'
  lacks "$log" 'pa@ss'
  lacks "$log" 'ss@proxy'
}

# --- maven mirror --------------------------------------------------------------
reachable_mirror_writes_a_private_init_script_idempotently() {
  run_setup FAKE_MIRROR_UP=1
  run_setup FAKE_MIRROR_UP=1
  expect_exit_zero
  is_private "$init_script"
  has "$init_script" 'beforeSettings'
  has "$init_script" 'settings.pluginManagement.repositories'
  has "$init_script" 'settings.dependencyResolutionManagement.repositories'
  has "$init_script" "https://$mirror_host/maven2/"
  [[ "$(ls -A "$home/.gradle/init.d")" == 'cloud-maven-mirror.gradle' ]] || complain 'left work files in init.d'
  [[ "$(grep -c 'beforeSettings' "$init_script")" == 1 ]] || complain 'init script content duplicated'
  has "$stdout" "maven mirror: on ($mirror_host)"
}

# A build that declares no plugin repositories gets the Plugin Portal only while
# the list is empty, which the mirror would otherwise end.
init_script_keeps_the_default_plugin_portal() {
  run_setup FAKE_MIRROR_UP=1
  has "$init_script" 'settingsEvaluated'
  has "$init_script" 'gradlePluginPortal()'
}

probes_the_mirror_once_with_a_short_timeout() {
  run_setup FAKE_MIRROR_UP=1
  call_count "$mirror_host" 1
  has "$state/calls" '--max-time'
  lacks "$state/calls" '--retry'
  # The JVM ignores NO_PROXY, so the probe has to take the path the builds take.
  has "$state/calls" '--noproxy'
}

blocked_mirror_removes_a_stale_init_script_and_names_the_domain() {
  run_setup FAKE_MIRROR_UP=1
  is_file "$init_script"
  run_setup
  expect_exit_zero
  is_absent "$init_script"
  has "$stdout" "maven mirror: blocked, allow $mirror_host"
  [[ "$(grep -c "$mirror_host" "$stdout")" == 1 ]] || complain 'expected one summary line naming the domain'
}

a_failed_mirror_probe_still_exits_zero() {
  run_setup
  expect_exit_zero
  [[ ! -s "$stderr" ]] || complain 'wrote to stderr'
  is_absent "$init_script"
  has "$stdout" 'dependencies: installed'
}

an_unwritable_init_directory_is_reported_and_keeps_the_flags_off() {
  : >"$home/.gradle"
  run_setup FAKE_MIRROR_UP=1
  expect_exit_zero
  has "$stdout" 'maven mirror: FAILED'
  lacks "$env_file" 'JAVA_TOOL_OPTIONS'
}

robolectric_flags_are_written_with_a_proxy() {
  run_setup HTTPS_PROXY="$proxy_url" FAKE_MIRROR_UP=1
  has "$jvm_options" '-Dhttps.proxyHost="proxy.example.com"'
  has "$jvm_options" "-Drobolectric.dependency.repo.url=\"https://$mirror_host/maven2/\""
  has "$jvm_options" '-Drobolectric.dependency.repo.id="cloudMavenCentralMirror"'
  is_private "$jvm_options"
}

robolectric_flags_are_written_without_a_proxy() {
  run_setup FAKE_MIRROR_UP=1
  has "$jvm_options" "-Drobolectric.dependency.repo.url=\"https://$mirror_host/maven2/\""
  lacks "$jvm_options" 'proxyHost'
  is_private "$jvm_options"
  has "$env_file" "export JAVA_TOOL_OPTIONS='-XX:VMOptionsFile=$jvm_options'"
  is_absent "$gradle_props"
}

robolectric_flags_are_absent_when_the_mirror_is_blocked() {
  run_setup HTTPS_PROXY="$proxy_url" FAKE_MIRROR_UP=1
  has "$jvm_options" 'robolectric'
  run_setup HTTPS_PROXY="$proxy_url"
  lacks "$jvm_options" 'robolectric'
  has "$jvm_options" '-Dhttps.proxyHost="proxy.example.com"'
}

# JAVA_TOOL_OPTIONS may still name the file, and a JVM refuses to start when the
# options file is missing, so it is emptied instead of removed.
a_blocked_mirror_empties_the_options_file_instead_of_removing_it() {
  run_setup FAKE_MIRROR_UP=1
  has "$jvm_options" 'robolectric'
  run_setup
  expect_exit_zero
  is_file "$jvm_options"
  [[ ! -s "$jvm_options" ]] || complain 'options file should be empty'
  is_private "$jvm_options"
}

an_unparseable_proxy_still_gets_the_mirror_flags_and_no_proxy_flags() {
  run_setup HTTPS_PROXY='http://proxy.example.com:notaport' FAKE_MIRROR_UP=1
  expect_exit_zero
  has "$jvm_options" 'robolectric.dependency.repo.url'
  lacks "$jvm_options" 'proxyHost'
  is_absent "$gradle_props"
}

# --- failure and summary -------------------------------------------------------
exits_zero_when_every_step_fails() {
  rm -rf "$node_root/node24"
  rm "$state/docker-up"
  run_setup FAKE_ALL_FAIL=1 HTTPS_PROXY="$proxy_url"
  expect_exit_zero
  [[ ! -s "$stderr" ]] || complain 'wrote to stderr'
  has "$stdout" 'node: FAILED'
  has "$stdout" 'dependencies: FAILED'
  has "$stdout" 'services: FAILED'
  is_absent "$hash_file"
}

exits_zero_when_the_repo_is_unusable() {
  rm -f "$repo/.nvmrc" "$repo/package-lock.json" "$repo/server/api/.env.test" "$repo/docker-compose.test.yml"
  run_setup FAKE_COMPOSE_FAIL=1
  expect_exit_zero
  has "$stdout" 'node: FAILED'
  has "$stdout" 'services: FAILED'
}

exits_zero_when_the_log_cannot_be_written() {
  run_setup CLOUD_SETUP_LOG="$world/no/such/dir/setup.log"
  expect_exit_zero
  has "$stdout" 'dependencies: installed'
}

writes_step_output_only_to_the_log() {
  run_setup HTTPS_PROXY='http://proxy.example.com:3128' FAKE_TOOLS_ECHO_PROXY=1
  lacks "$stdout" 'npm via'
  lacks "$stdout" 'docker via'
  [[ ! -s "$stderr" ]] || complain 'wrote to stderr'
  has "$log" 'npm via'
  has "$stdout" "$log"
}

keeps_the_summary_under_ten_lines() {
  run_setup HTTPS_PROXY="$proxy_url"
  [[ "$(wc -l <"$stdout")" -lt 10 ]] || complain 'summary is too long'
  [[ -s "$stdout" ]] || complain 'summary is empty'
  lacks "$stdout" 'proxy.example.com'
}

# Finds the repo through the script's own location when the variable is missing.
falls_back_to_the_scripts_parent_directory() {
  mkdir -p "$repo/scripts/ci"
  cp "$setup_script" "$repo/scripts/cloud-setup.sh"
  cp "$script_dir/require-npm.sh" "$repo/scripts/ci/require-npm.sh"
  git -C "$repo" add -A
  env -i HOME="$home" PATH="$fake:/usr/bin:/bin:/usr/sbin:/sbin" TMPDIR="$world/tmp" \
    CLAUDE_CODE_REMOTE=true CLOUD_SETUP_NODE_ROOT="$node_root" \
    CLOUD_SETUP_ANDROID_SDK="$world/no-android-sdk" FAKE_STATE="$state" \
    bash "$repo/scripts/cloud-setup.sh" >"$stdout" 2>"$stderr" || complain 'non-zero exit'
  is_file "$hash_file"
}

for name in \
  exits_immediately_outside_the_cloud \
  uses_the_preinstalled_node_when_present \
  uses_the_node_on_path_when_it_has_the_wanted_major \
  downloads_and_verifies_node_when_it_is_missing \
  leaves_no_node_dir_when_the_checksum_fails \
  installs_on_the_first_run_and_records_the_hash \
  skips_install_when_lockfiles_are_unchanged \
  reinstalls_when_a_workspace_manifest_changes \
  reinstalls_when_the_lockfile_changes \
  reinstalls_when_the_node_version_changes \
  reinstalls_when_a_workspace_is_added \
  reinstalls_when_an_npmrc_appears \
  retries_after_a_failed_install \
  retries_after_a_failed_rebuild \
  a_failed_reinstall_discards_the_old_hash \
  uses_ci_install_policy_and_never_npm_install \
  refuses_to_install_with_an_npm_too_old_for_the_scripts_policy \
  does_not_install_when_node_is_unavailable \
  installs_git_hooks_and_the_browser_after_a_successful_install \
  a_failed_git_hook_install_is_reported_and_retried \
  a_failed_browser_download_does_not_fail_the_install \
  starts_the_test_services_with_docker_compose \
  starts_the_docker_service_when_the_daemon_is_down \
  starts_dockerd_when_the_docker_service_cannot \
  a_daemon_started_by_a_step_does_not_hold_the_hook_open \
  falls_back_to_native_postgres_when_docker_fails \
  falls_back_to_native_postgres_when_docker_will_not_start \
  reads_database_values_from_env_test \
  native_postgres_setup_is_idempotent_on_resume \
  reports_failed_services_when_the_fallback_fails_too \
  env_file_lines_are_not_duplicated_on_resume \
  exports_the_android_sdk_when_present \
  reports_a_missing_android_sdk \
  survives_a_missing_env_file_variable \
  env_file_is_valid_shell \
  writes_proxy_to_gradle_properties_idempotently \
  replaces_the_proxy_block_when_the_proxy_changes \
  reads_a_lowercase_proxy_without_a_scheme_or_credentials \
  escapes_backslashes_for_the_properties_format \
  writes_nothing_for_the_jvm_without_a_proxy_or_a_mirror \
  jvm_flags_reach_test_jvms_from_a_private_file \
  java_tool_options_never_carries_credentials \
  keeps_existing_java_tool_options \
  never_prints_proxy_credentials \
  never_prints_a_proxy_password_with_a_raw_at_sign \
  reachable_mirror_writes_a_private_init_script_idempotently \
  init_script_keeps_the_default_plugin_portal \
  probes_the_mirror_once_with_a_short_timeout \
  blocked_mirror_removes_a_stale_init_script_and_names_the_domain \
  a_failed_mirror_probe_still_exits_zero \
  an_unwritable_init_directory_is_reported_and_keeps_the_flags_off \
  robolectric_flags_are_written_with_a_proxy \
  robolectric_flags_are_written_without_a_proxy \
  robolectric_flags_are_absent_when_the_mirror_is_blocked \
  a_blocked_mirror_empties_the_options_file_instead_of_removing_it \
  an_unparseable_proxy_still_gets_the_mirror_flags_and_no_proxy_flags \
  exits_zero_when_every_step_fails \
  exits_zero_when_the_repo_is_unusable \
  exits_zero_when_the_log_cannot_be_written \
  writes_step_output_only_to_the_log \
  keeps_the_summary_under_ten_lines \
  falls_back_to_the_scripts_parent_directory; do
  spec "$name"
done

if [[ $failures -gt 0 ]]; then
  echo "cloud-setup-test: ${failures} failure(s)" >&2
  exit 1
fi
echo 'cloud-setup-test: all checks passed'
