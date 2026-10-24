// SPDX-License-Identifier: AGPL-3.0-or-later
import { test as base, type BrowserContext } from '@playwright/test'
import { startFixtureServer, type FixtureServer } from './fixtureServer'
import { launchExtension, type ExtensionBuild, type LaunchedExtension } from './launchExtension'

interface ExtensionFixtures {
  /** Which build to load: `test.use({ extensionBuild: 'dev' })` for the UI kit gallery. */
  extensionBuild: ExtensionBuild
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
  fixtureServer: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring
    async ({}, use) => {
      const server = await startFixtureServer()
      await use(server)
      await server.close()
    },
    { scope: 'worker' },
  ],
  launched: async ({ fixtureServer, locale, extensionBuild }, use) => {
    const launched = await launchExtension({
      fixturePort: fixtureServer.port,
      locale,
      build: extensionBuild,
    })
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
