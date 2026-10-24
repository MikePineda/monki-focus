// SPDX-License-Identifier: AGPL-3.0-or-later
import preact from '@preact/preset-vite'
import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

// Component, theme and page specs need a DOM; everything else (service
// worker, config, e2e support) runs in plain Node, where `node:https` and
// WebCrypto behave exactly as in production.
const DOM_SPECS = ['tests/unit/{ui,theme,dev}/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.tsx']

export default defineConfig({
  // WxtVitest wires `fakeBrowser` as `browser`, the WXT aliases and the
  // `define*` globals so entrypoints run unchanged under Vitest. The Preact
  // preset compiles TSX exactly like the extension build.
  plugins: [WxtVitest(), preact()],
  test: {
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['tests/unit/**/*.test.{ts,tsx}'],
          exclude: DOM_SPECS,
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: DOM_SPECS,
          setupFiles: ['tests/support/domSetup.ts'],
        },
      },
    ],
  },
})
