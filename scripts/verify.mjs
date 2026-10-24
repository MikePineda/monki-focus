// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The pull-request gate (`npm run verify`, `verify:quick`, `verify:all`).
 *
 * Placeholder: today it only runs the turbo pipeline for the JS/TS
 * workspaces. Work package 0.7 replaces it with per-component change
 * detection (git diff against the merge base), the Android (Gradle) and
 * macOS (Swift/Xcode) layers, the optional E2E run and a summary by layer.
 */
import { spawnSync } from 'node:child_process'

const modes = new Set(process.argv.slice(2))
const label = modes.has('--all') ? 'all' : modes.has('--quick') ? 'quick' : 'default'

console.log(`verify (${label}): component detection lands in WP 0.7`)

const result = spawnSync(
  'npx',
  ['--no-install', 'turbo', 'run', 'lint', 'typecheck', 'test', 'build'],
  {
    stdio: 'inherit',
  }
)

process.exit(result.status ?? 1)
