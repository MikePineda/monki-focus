// SPDX-License-Identifier: AGPL-3.0-or-later
import preact from '@preact/preset-vite'
import { defineConfig } from 'wxt'
import { isEntrypointBuilt } from './config/devOnlyEntrypoints'
import { extensionManifest } from './config/extensionManifest'

// Modes: `wxt` and `build:dev` -> development, `build:e2e` -> e2e,
// `build`/`zip` -> production. Output lands in `.output/chrome-mv3{,-dev,-e2e}`.
export default defineConfig({
  srcDir: 'src',
  publicDir: 'public',
  imports: false,
  manifest: ({ mode }) =>
    extensionManifest({ mode, devPublicKey: process.env.EXTENSION_DEV_PUBLIC_KEY }),
  vite: () => ({
    plugins: [preact()],
  }),
  hooks: {
    // The UI kit gallery (dev.html) only exists in the development build.
    'entrypoints:resolved': (wxt, entrypoints) => {
      for (const entrypoint of entrypoints) {
        if (!isEntrypointBuilt(entrypoint.name, wxt.config.mode)) entrypoint.skipped = true
      }
    },
  },
  zip: {
    // Release asset name: monki-focus-extension-<version>-chrome.zip
    name: 'monki-focus-extension',
  },
})
