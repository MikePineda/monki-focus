// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Entrypoints that exist only in the development build: `dev` is the UI kit
 * gallery (`/dev.html`). The e2e and production builds, and therefore the
 * release zip, never contain them.
 */
export const DEV_ONLY_ENTRYPOINTS: readonly string[] = ['dev']

export function isEntrypointBuilt(name: string, mode: string): boolean {
  return mode === 'development' || !DEV_ONLY_ENTRYPOINTS.includes(name)
}
