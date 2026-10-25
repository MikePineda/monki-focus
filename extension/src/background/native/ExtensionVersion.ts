// SPDX-License-Identifier: AGPL-3.0-or-later

/** The version the bridge's `hello` reports when the manifest cannot be read. */
export const UNKNOWN_EXTENSION_VERSION = '0.0.0'

/** The manifest `version` (the `hello` payload's `extensionVersion`). */
export function extensionVersion(runtime: { getManifest(): { version: string } }): string {
  try {
    return runtime.getManifest().version
  } catch {
    return UNKNOWN_EXTENSION_VERSION
  }
}
