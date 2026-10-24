// SPDX-License-Identifier: AGPL-3.0-or-later
import { test as base, type BrowserContext } from '@playwright/test'
import { starterRuleset, useRuleset, type StartingRuleset } from './extensionStorage'
import { startFixtureServer, type FixtureServer } from './fixtureServer'
import { launchExtension, type ExtensionBuild, type LaunchedExtension } from './launchExtension'

interface ExtensionFixtures {
  /** Which build to load: `test.use({ extensionBuild: 'dev' })` for the UI kit gallery. */
  extensionBuild: ExtensionBuild
  /**
   * The rule set before the spec runs: `gateless` (default: feeds only, no
   * gate, no bedtime), `gated` (the starter without bedtime) or `untouched`.
   */
  startingRuleset: StartingRuleset
  launched: LaunchedExtension
  context: BrowserContext
  extensionId: string
  /** `chrome-extension://<id>/<path>` for a page of the extension under test. */
  extensionUrl: (path: string) => string
}

interface WorkerFixtures {
  fixtureServer: FixtureServer
}

/**
 * Playwright test with the e2e build loaded in a fresh persistent Chromium
 * profile per test and one HTTPS fixture server per worker. The built-in
 * `locale` option (`test.use({ locale: 'es' })`) drives the browser language.
 */
export const test = base.extend<ExtensionFixtures, WorkerFixtures>({
  extensionBuild: ['e2e', { option: true }],
  startingRuleset: ['gateless', { option: true }],
  fixtureServer: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring
    async ({}, use) => {
      const server = await startFixtureServer()
      await use(server)
      await server.close()
    },
    { scope: 'worker' },
  ],
  launched: async ({ fixtureServer, locale, extensionBuild, startingRuleset }, use) => {
    const launched = await launchExtension({
      fixturePort: fixtureServer.port,
      locale,
      build: extensionBuild,
    })
    // The starter gates Reddit and X and has a bedtime: specs about other
    // things start from a rule set that leaves every page alone.
    if (extensionBuild === 'e2e' && startingRuleset !== 'untouched') {
      const friction = startingRuleset === 'gated'
      await useRuleset(launched.context, starterRuleset({ friction }), friction ? 2 : 0)
    }
    await use(launched)
    await launched.context.close()
  },
  context: async ({ launched }, use) => {
    await use(launched.context)
  },
  extensionId: async ({ launched }, use) => {
    await use(launched.extensionId)
  },
  extensionUrl: async ({ extensionId }, use) => {
    await use((path) => `chrome-extension://${extensionId}/${path.replace(/^\//, '')}`)
  },
})

export { expect } from '@playwright/test'
