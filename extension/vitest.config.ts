// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

export default defineConfig({
  // WxtVitest wires `fakeBrowser` as `browser`, the WXT aliases and the
  // `define*` globals so entrypoints run unchanged under Vitest.
  plugins: [WxtVitest()],
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
})
