// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from '@playwright/test'

const workers = Number(process.env.E2E_WORKERS) || undefined

// Every test launches its own persistent Chromium with the e2e build (see
// e2e/support/extensionTest.ts); there is no shared browser or `projects`.
export default defineConfig({
  testDir: 'e2e/tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  ...(workers ? { workers } : {}),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
  },
})
