#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Prepares an Anthropic-hosted Claude Code cloud session: the Node version of
# .nvmrc, the dependencies, the test services, the session environment and the
# JVM proxy. Runs from the SessionStart hook in .claude/settings.json, on startup
# and on resume, so every step is idempotent and fast when nothing changed.
#
# It does nothing outside a cloud session. It never fails the session: it always
# exits 0, and a step that fails is reported in the summary. Step output goes to
# the log, only the summary reaches stdout (and so Claude's context). The proxy
# credentials never reach either. Specification: scripts/ci/cloud-setup-test.sh
#
# Overrides: CLOUD_SETUP_LOG, CLOUD_SETUP_NODE_ROOT, CLOUD_SETUP_NODE_DIST,
# CLOUD_SETUP_ANDROID_SDK.

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="${CLAUDE_PROJECT_DIR:-$(dirname "$script_dir")}"
log="${CLOUD_SETUP_LOG:-${TMPDIR:-/tmp}/cloud-setup.log}"
node_root="${CLOUD_SETUP_NODE_ROOT:-/opt}"
node_dist="${CLOUD_SETUP_NODE_DIST:-https://nodejs.org/dist}"
android_sdk="${CLOUD_SETUP_ANDROID_SDK:-/opt/android-sdk}"
hash_file='node_modules/.cloud-setup.sha256'

node_bin=''
node_status='FAILED'
dependencies_status='FAILED'
services_status='FAILED'
android_status='absent'

(umask 077 && : >>"$log") 2>/dev/null || log=/dev/null
# fd 3 keeps the hook's stdout for the summary; everything else lands in the log.
# stdin holds the hook's JSON payload, which no step should consume.
exec 3>&1 >>"$log" 2>&1 </dev/null
echo "--- cloud setup, $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Masks `user:password@` wherever a tool echoes a proxy URL.
redact_credentials() {
  sed -E 's#[^/[:space:]]*:[^/[:space:]]*@#***@#g'
}

# Runs a command with its output redacted into the log. The output goes through
# a temp file, not a pipe, and fd 3 is closed: a daemon started by the command
# inherits both, and holding either open would keep the hook from finishing.
log_step() {
  local output status=0
  output="$(mktemp)" || {
    "$@" >/dev/null 2>&1 3>&-
    return
  }
  "$@" >"$output" 2>&1 3>&- || status=$?
  redact_credentials <"$output" >>"$log"
  rm -f "$output"
  return "$status"
}

# --- 1. Node -------------------------------------------------------------------
wanted_node_major() {
  local wanted
  wanted="$(tr -d '[:space:]' <.nvmrc 2>/dev/null)"
  wanted="${wanted#v}"
  printf '%s' "${wanted%%.*}"
}

node_major_on_path() {
  local version
  version="$(node -v 2>/dev/null)"
  version="${version#v}"
  printf '%s' "${version%%.*}"
}

# shellcheck disable=SC2329 # Invoked through log_step.
verify_node_tarball() {
  (cd "$1" && sha256sum -c tarball.sha256)
}

# shellcheck disable=SC2329 # Invoked through log_step.
extract_node_tarball() {
  mkdir -p "$2" && tar -xJf "$1" -C "$2" --strip-components=1
}

download_node() {
  local major="$1" work="$2" version_url tarball
  version_url="$node_dist/latest-v$major.x"
  log_step curl -fsSL --retry 2 --max-time 120 -o "$work/SHASUMS256.txt" "$version_url/SHASUMS256.txt" || return 1
  awk '$2 ~ /^node-v[0-9.]+-linux-x64\.tar\.xz$/ { print; exit }' "$work/SHASUMS256.txt" >"$work/tarball.sha256"
  tarball="$(awk '{ print $2 }' "$work/tarball.sha256")"
  [ -n "$tarball" ] || return 1
  log_step curl -fsSL --retry 2 --max-time 300 -o "$work/$tarball" "$version_url/$tarball" || return 1
  log_step verify_node_tarball "$work" || return 1
  log_step extract_node_tarball "$work/$tarball" "$work/extracted" || return 1
  [ -x "$work/extracted/bin/node" ]
}

# Builds next to the target and moves it in last, so a failure leaves nothing
# that looks like an installed Node.
install_node() {
  local major="$1" target work result=0
  target="$node_root/node$major"
  mkdir -p "$node_root" || return 1
  work="$(mktemp -d "$node_root/.node$major.XXXXXX")" || return 1
  if download_node "$major" "$work"; then
    rm -rf "$target"
    mv "$work/extracted" "$target" || result=1
  else
    result=1
  fi
  rm -rf "$work"
  return "$result"
}

step_node() {
  local major
  major="$(wanted_node_major)"
  [ -n "$major" ] || return 0
  if [ "$(node_major_on_path)" = "$major" ]; then
    node_bin="$(dirname "$(command -v node)")"
  elif [ -x "$node_root/node$major/bin/node" ] || install_node "$major"; then
    node_bin="$node_root/node$major/bin"
  else
    return 0
  fi
  export PATH="$node_bin:$PATH"
  node_status="$("$node_bin/node" -v) ($node_bin/node)"
}

# --- 2. Dependencies -----------------------------------------------------------
# The digest covers each file's content and its path, so a new, removed or
# renamed manifest changes it as well as an edited one.
dependencies_fingerprint() {
  {
    git -c safe.directory="$repo" ls-files -- package.json '**/package.json' 2>/dev/null
    printf '%s\n' package.json package-lock.json .nvmrc .npmrc
  } | LC_ALL=C sort -u | while IFS= read -r file; do
    if [ -f "$file" ]; then sha256sum "$file"; fi
  done | sha256sum | cut -d' ' -f1
}

# The same policy as CI: only install scripts approved in the root package.json
# `allowScripts` run. An npm older than require-npm.sh's minimum would not enforce
# it, and `npm ci` rather than `npm install` keeps the lockfile untouched.
install_dependencies() {
  log_step bash "$script_dir/ci/require-npm.sh" &&
    log_step npm ci --ignore-scripts &&
    log_step npm rebuild --strict-allow-scripts
}

install_browser() {
  [ -d extension ] || return 0
  (cd extension && log_step timeout 180 npx --no-install playwright install chromium)
}

step_dependencies() {
  [ -n "$node_bin" ] || return 0
  local fingerprint
  fingerprint="$(dependencies_fingerprint)"
  if [ -n "$fingerprint" ] && [ "$fingerprint" = "$(cat "$hash_file" 2>/dev/null)" ]; then
    dependencies_status='up to date'
    return 0
  fi
  rm -f "$hash_file"
  install_dependencies || return 0
  # Written only now: `npm ci` deletes node_modules, and without a hash a failed
  # install is retried by the next session.
  mkdir -p node_modules
  printf '%s\n' "$fingerprint" >"$hash_file"
  dependencies_status='installed'
  log_step npx --no-install lefthook install
  install_browser
}

# --- 3. Services ---------------------------------------------------------------
docker_is_up() {
  docker info >/dev/null 2>&1 3>&-
}

wait_for_docker() {
  local attempt=0
  while [ "$attempt" -lt "$1" ]; do
    docker_is_up && return 0
    sleep 1
    attempt=$((attempt + 1))
  done
  return 1
}

start_docker_daemon() {
  command -v docker >/dev/null 2>&1 || return 1
  docker_is_up && return 0
  log_step service docker start
  wait_for_docker 5 && return 0
  command -v dockerd >/dev/null 2>&1 || return 1
  # Its output is dropped: it outlives this script and runs with the proxy
  # variables in its environment, so it must not write to the log.
  nohup dockerd </dev/null >/dev/null 2>&1 3>&- &
  disown
  wait_for_docker 20
}

# Reads a value from server/api/.env.test, the source of truth for the test
# database. The file is parsed, never sourced.
env_test_value() {
  sed -n "s/^$1=//p" server/api/.env.test 2>/dev/null | tail -n 1 | tr -d '\r'
}

as_postgres() {
  # From /, which the postgres user can always enter.
  if command -v su >/dev/null 2>&1; then
    (cd / && su postgres -c "$1")
  else
    (cd / && sudo -u postgres sh -c "$1")
  fi
}

postgres_answers() {
  printf 'SELECT 1;\n' | as_postgres "psql -q -p $1 -d postgres" >/dev/null 2>&1
}

# Prints the first of the given ports that answers, waiting up to ~20s.
wait_for_postgres() {
  local attempt=0 port
  while [ "$attempt" -lt 20 ]; do
    for port in "$@"; do
      if postgres_answers "$port"; then
        printf '%s' "$port"
        return 0
      fi
    done
    sleep 1
    attempt=$((attempt + 1))
  done
  return 1
}

sql_literal() {
  local quote="'" doubled="''"
  printf "'%s'" "${1//$quote/$doubled}"
}

# The SQL travels on stdin, so no value ends up in a process listing or a shell
# quoting problem. citext is created here, as superuser, for the migrations.
postgres_bootstrap_sql() {
  local user password database
  user="$(sql_literal "$1")"
  password="$(sql_literal "$2")"
  database="$(sql_literal "$3")"
  cat <<EOF
SELECT format('CREATE ROLE %I', $user) WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $user) \gexec
SELECT format('ALTER ROLE %I LOGIN CREATEDB PASSWORD %L', $user, $password) \gexec
SELECT format('CREATE DATABASE %I OWNER %I', $database, $user) WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = $database) \gexec
SELECT $database AS target \gset
\connect :"target"
CREATE EXTENSION IF NOT EXISTS citext;
EOF
}

start_native_postgres() {
  local port user password database current
  port="$(env_test_value DB_PORT)"
  user="$(env_test_value DB_USER)"
  password="$(env_test_value DB_PASSWORD)"
  database="$(env_test_value DB_DATABASE)"
  [ -n "$user" ] && [ -n "$password" ] && [ -n "$database" ] || return 1
  case "$port" in
  '' | *[!0-9]*) return 1 ;;
  esac

  log_step service postgresql start
  current="$(wait_for_postgres "$port" 5432)" || return 1
  if [ "$current" != "$port" ]; then
    printf 'ALTER SYSTEM SET port = %s;\n' "$port" |
      log_step as_postgres "psql -q -v ON_ERROR_STOP=1 -p $current -d postgres" || return 1
    log_step service postgresql restart || return 1
    wait_for_postgres "$port" >/dev/null || return 1
  fi
  postgres_bootstrap_sql "$user" "$password" "$database" |
    log_step as_postgres "psql -q -v ON_ERROR_STOP=1 -p $port -d postgres"
}

step_services() {
  if start_docker_daemon; then
    if log_step timeout 120 docker compose -f docker-compose.test.yml up -d --wait; then
      services_status='docker (db + ntfy)'
      return 0
    fi
    # A partial start could still hold the database port.
    log_step timeout 60 docker compose -f docker-compose.test.yml down -v
  fi
  if start_native_postgres; then
    services_status='native postgres, ntfy missing (the real-ntfy test group skips)'
  fi
}

# --- 4. Environment ------------------------------------------------------------
append_env_line() {
  [ -n "${CLAUDE_ENV_FILE:-}" ] || return 0
  grep -qxF -- "$1" "$CLAUDE_ENV_FILE" 2>/dev/null || printf '%s\n' "$1" >>"$CLAUDE_ENV_FILE"
}

# shellcheck disable=SC2016 # $PATH is meant to expand when the file is sourced.
step_environment() {
  if [ -d "$android_sdk" ]; then
    android_status="present ($android_sdk)"
    append_env_line "export ANDROID_HOME=$android_sdk"
    append_env_line "export PATH=\"$android_sdk/cmdline-tools/latest/bin:$android_sdk/platform-tools:\$PATH\""
  fi
  if [ -n "$node_bin" ]; then
    append_env_line "export PATH=\"$node_bin:\$PATH\""
  fi
  append_env_line 'export TURBO_TELEMETRY_DISABLED=1'
  append_env_line 'export NODE_OPTIONS=--max-old-space-size=4096'
}

# --- 5. JVM proxy --------------------------------------------------------------
proxy_host=''
proxy_port=''
proxy_user=''
proxy_password=''

percent_decode() {
  local value="${1//\\/\\\\}"
  printf '%b' "${value//%/\\x}" | tr -d '\r\n'
}

# Sets the proxy_* variables. Accepts [scheme://][user[:password]@]host[:port].
parse_proxy_url() {
  local authority="$1" credentials=''
  case "$authority" in
  *://*) authority="${authority#*://}" ;;
  esac
  authority="${authority%%/*}"
  case "$authority" in
  *@*)
    credentials="${authority%@*}"
    authority="${authority##*@}"
    ;;
  esac
  case "$authority" in
  *:*)
    proxy_host="${authority%:*}"
    proxy_port="${authority##*:}"
    ;;
  *)
    proxy_host="$authority"
    proxy_port=80
    ;;
  esac
  [ -n "$proxy_host" ] || return 1
  case "$proxy_port" in
  '' | *[!0-9]*) return 1 ;;
  esac
  if [ -n "$credentials" ]; then
    proxy_user="$(percent_decode "${credentials%%:*}")"
    case "$credentials" in
    *:*) proxy_password="$(percent_decode "${credentials#*:}")" ;;
    esac
  fi
}

# Replaces a file from stdin in one move, readable by its owner only.
write_private_file() {
  local next
  next="$(mktemp "$1.XXXXXX")" || return 1
  cat >"$next" && chmod 600 "$next" && mv -f "$next" "$1"
}

gradle_proxy_block() {
  local scheme value
  echo '# >>> cloud-setup proxy >>>'
  for scheme in http https; do
    echo "systemProp.$scheme.proxyHost=$proxy_host"
    echo "systemProp.$scheme.proxyPort=$proxy_port"
    if [ -n "$proxy_user" ]; then
      value="${proxy_user//\\/\\\\}"
      printf 'systemProp.%s.proxyUser=%s\n' "$scheme" "$value"
    fi
    if [ -n "$proxy_password" ]; then
      value="${proxy_password//\\/\\\\}"
      printf 'systemProp.%s.proxyPassword=%s\n' "$scheme" "$value"
    fi
  done
  echo 'systemProp.jdk.http.auth.tunneling.disabledSchemes='
  echo 'systemProp.http.nonProxyHosts=localhost|127.0.0.1'
  echo '# <<< cloud-setup proxy <<<'
}

write_gradle_proxy() {
  local file="$1/gradle.properties"
  {
    if [ -f "$file" ]; then
      sed '/^# >>> cloud-setup proxy >>>$/,/^# <<< cloud-setup proxy <<<$/d' "$file"
    fi
    gradle_proxy_block
  } | write_private_file "$file"
}

# One flag per line, quoted the way HotSpot's options file parser expects.
jvm_flag() {
  case "$2" in
  *\"*) printf "%s='%s'\n" "-D$1" "$2" ;;
  *) printf '%s="%s"\n' "-D$1" "$2" ;;
  esac
}

jvm_proxy_flags() {
  local scheme
  for scheme in http https; do
    jvm_flag "$scheme.proxyHost" "$proxy_host"
    jvm_flag "$scheme.proxyPort" "$proxy_port"
    if [ -n "$proxy_user" ]; then jvm_flag "$scheme.proxyUser" "$proxy_user"; fi
    if [ -n "$proxy_password" ]; then jvm_flag "$scheme.proxyPassword" "$proxy_password"; fi
  done
  jvm_flag jdk.http.auth.tunneling.disabledSchemes ''
  jvm_flag http.nonProxyHosts 'localhost|127.0.0.1'
}

# Test JVMs do not read gradle.properties, hence JAVA_TOOL_OPTIONS. The JVM echoes
# that variable to stderr on every start ("Picked up JAVA_TOOL_OPTIONS: ..."), so
# it only names a private file holding the flags, never the credentials.
export_jvm_proxy() {
  local options_file="$1/cloud-setup-jvm.options" options quote="'" escaped="'\\''"
  jvm_proxy_flags | write_private_file "$options_file" || return 1
  options="-XX:VMOptionsFile=$options_file"
  case "${JAVA_TOOL_OPTIONS:-}" in
  '') ;;
  *VMOptionsFile*) options="$JAVA_TOOL_OPTIONS" ;;
  *) options="$JAVA_TOOL_OPTIONS $options" ;;
  esac
  append_env_line "export JAVA_TOOL_OPTIONS='${options//$quote/$escaped}'"
}

step_jvm_proxy() {
  local url="${HTTPS_PROXY:-${https_proxy:-}}" gradle_dir="${HOME:-/root}/.gradle"
  [ -n "$url" ] || return 0
  if ! parse_proxy_url "$url"; then
    echo 'jvm proxy: the proxy variable could not be parsed, skipping'
    return 0
  fi
  (umask 077 && mkdir -p "$gradle_dir") || return 0
  write_gradle_proxy "$gradle_dir" || echo 'jvm proxy: could not write gradle.properties'
  export_jvm_proxy "$gradle_dir" || echo 'jvm proxy: could not write the JVM options file'
}

# --- 6. Summary ----------------------------------------------------------------
print_summary() {
  {
    echo 'cloud session setup:'
    echo "node: $node_status"
    echo "dependencies: $dependencies_status"
    echo "services: $services_status"
    echo "android sdk: $android_status"
    echo "log: $log"
  } >&3
}

if cd "$repo"; then
  step_node
  step_dependencies
  step_services
  step_environment
  step_jvm_proxy
fi
print_summary
exit 0
