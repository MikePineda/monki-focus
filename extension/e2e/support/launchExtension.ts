// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type BrowserContext } from '@playwright/test'
import { hostResolverRules } from './fixtureServer'

const OUTPUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../.output')

/** Output of `npm run build:e2e` (`wxt build --mode e2e`). */
export const E2E_BUILD_DIR = resolve(OUTPUT_DIR, 'chrome-mv3-e2e')
/** Output of `npm run build:dev`: the only build with the UI kit gallery (dev.html). */
export const DEV_BUILD_DIR = resolve(OUTPUT_DIR, 'chrome-mv3-dev')

export type ExtensionBuild = 'e2e' | 'dev'

const BUILD_DIRS: Record<ExtensionBuild, string> = { e2e: E2E_BUILD_DIR, dev: DEV_BUILD_DIR }
const BUILD_COMMANDS: Record<ExtensionBuild, string> = { e2e: 'build:e2e', dev: 'build:dev' }

export interface LaunchedExtension {
  context: BrowserContext
  extensionId: string
}

export interface LaunchOptions {
  fixturePort: number
  locale?: string | undefined
  headless?: boolean | undefined
  /** `e2e` (default) for journeys; `dev` only for the UI kit gallery. */
  build?: ExtensionBuild | undefined
}

/**
 * Starts Playwright's bundled Chromium with an unpacked build loaded (the
 * e2e build unless `build: 'dev'`).
 *
 * - `channel: 'chromium'` selects the full Chromium build, which runs
 *   extensions in the new headless mode; the default headless shell does not
 *   load extensions at all.
 * - Branded Chrome 137+ ignores `--load-extension`, so this never uses
 *   `channel: 'chrome'`.
 * - Extensions need a persistent context; `''` gives a fresh temp profile.
 */
export async function launchExtension({
  fixturePort,
  locale,
  headless = true,
  build = 'e2e',
}: LaunchOptions): Promise<LaunchedExtension> {
  const buildDir = BUILD_DIRS[build]
  if (!existsSync(resolve(buildDir, 'manifest.json'))) {
    throw new Error(
      `No ${build} build at ${buildDir}; run \`npm run ${BUILD_COMMANDS[build]}\` first.`
    )
  }
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless,
    ...(locale ? { locale } : {}),
    ignoreHTTPSErrors: true,
    args: [
      `--disable-extensions-except=${buildDir}`,
      `--load-extension=${buildDir}`,
      `--host-resolver-rules=${hostResolverRules(fixturePort)}`,
      '--ignore-certificate-errors',
      ...(locale ? [`--lang=${locale}`] : []),
    ],
  })
  const [existing] = context.serviceWorkers()
  const worker = existing ?? (await context.waitForEvent('serviceworker'))
  const extensionId = new URL(worker.url()).host
  return { context, extensionId }
}
