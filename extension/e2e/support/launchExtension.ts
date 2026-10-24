// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type BrowserContext } from '@playwright/test'
import { hostResolverRules } from './fixtureServer'

/** Output of `npm run build:e2e` (`wxt build --mode e2e`). */
export const E2E_BUILD_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../.output/chrome-mv3-e2e'
)

export interface LaunchedExtension {
  context: BrowserContext
  extensionId: string
}

export interface LaunchOptions {
  fixturePort: number
  locale?: string | undefined
  headless?: boolean | undefined
}

/**
 * Starts Playwright's bundled Chromium with the unpacked e2e build loaded.
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
}: LaunchOptions): Promise<LaunchedExtension> {
  if (!existsSync(resolve(E2E_BUILD_DIR, 'manifest.json'))) {
    throw new Error(`No e2e build at ${E2E_BUILD_DIR}; run \`npm run build:e2e\` first.`)
  }
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless,
    ...(locale ? { locale } : {}),
    ignoreHTTPSErrors: true,
    args: [
      `--disable-extensions-except=${E2E_BUILD_DIR}`,
      `--load-extension=${E2E_BUILD_DIR}`,
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
