// SPDX-License-Identifier: AGPL-3.0-or-later
import preact from '@preact/preset-vite'
import { defineConfig } from 'wxt'
import { isEntrypointBuilt } from './config/devOnlyEntrypoints'
import { extensionManifest } from './config/extensionManifest'
import { rulesetValidatorPlugin } from './config/rulesetValidatorPlugin'

/** Modules of `@monki-focus/rules` and its validator that have no side effects at import. */
const RULES_VALIDATOR_MODULES =
  /[\\/](?:node_modules[\\/](?:ajv|ajv-formats|fast-uri|fast-deep-equal|json-schema-traverse|require-from-string)|packages[\\/]rules[\\/]dist)[\\/]/

// Modes: `wxt` and `build:dev` -> development, `build:e2e` -> e2e,
// `build`/`zip` -> production. Output lands in `.output/chrome-mv3{,-dev,-e2e}`.
export default defineConfig({
  srcDir: 'src',
  publicDir: 'public',
  imports: false,
  manifest: ({ mode }) =>
    extensionManifest({ mode, devPublicKey: process.env.EXTENSION_DEV_PUBLIC_KEY }),
  vite: () => ({
    plugins: [preact(), rulesetValidatorPlugin()],
    build: {
      rollupOptions: {
        treeshake: {
          // `@monki-focus/rules/pure` also exports the schema validator (ajv,
          // CommonJS), which the extension never calls: without this hint the
          // bundler keeps the whole validator in the worker and content script.
          moduleSideEffects: (id: string) => !RULES_VALIDATOR_MODULES.test(id),
        },
      },
    },
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
