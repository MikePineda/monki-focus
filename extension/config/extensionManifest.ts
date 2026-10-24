// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UserManifest } from 'wxt'

export interface ManifestInputs {
  /**
   * WXT build mode: `development` (`wxt`, `build:dev`), `e2e` (Playwright
   * build) or `production` (store/release zip).
   */
  mode: string
  /**
   * Base64 DER public key (no PEM armour) that pins the unpacked extension id.
   * Read from `EXTENSION_DEV_PUBLIC_KEY`; only used in development and e2e.
   * The matching private key never lives in the repo.
   */
  devPublicKey?: string | undefined
}

/** Sites the extension works on out of the box (02 §1.3). */
export const SITE_HOST_PERMISSIONS = [
  '*://*.reddit.com/*',
  '*://*.x.com/*',
  '*://*.twitter.com/*',
  '*://*.youtube.com/*',
  '*://*.instagram.com/*',
] as const

const MODES_WITH_KEY: readonly string[] = ['development', 'e2e']

/**
 * The manifest fields WXT does not derive from the entrypoints. Kept as a pure
 * function of the build mode and env so it is unit tested.
 */
export function extensionManifest({ mode, devPublicKey }: ManifestInputs): UserManifest {
  const key = devPublicKey?.trim()
  return {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: [
      'storage',
      'unlimitedStorage',
      'tabs',
      'idle',
      'alarms',
      'declarativeNetRequestWithHostAccess',
      'scripting',
    ],
    host_permissions: [...SITE_HOST_PERMISSIONS],
    // Asked per origin when the user adds a friction/block rule for another site.
    optional_host_permissions: ['<all_urls>'],
    incognito: 'spanning',
    // The intention gate is reached through a DNR redirect, so it must be
    // web accessible; the dynamic URL stops pages from fingerprinting the id.
    web_accessible_resources: [
      { resources: ['gate.html'], matches: ['<all_urls>'], use_dynamic_url: true },
    ],
    ...(MODES_WITH_KEY.includes(mode) && key ? { key } : {}),
  }
}
