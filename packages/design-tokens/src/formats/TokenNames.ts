// SPDX-License-Identifier: AGPL-3.0-or-later
/** How a kebab-case token name is spelled on each platform. */

/** `surface-0` -> `surface0`, `body-sm` -> `bodySm` (Kotlin and Swift members). */
export const camelName = (name: string): string =>
  name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())

/** `surface-0` -> `Surface0`. */
export const pascalName = (name: string): string =>
  camelName(name).replace(/^./, (c) => c.toUpperCase())

/** `duration-fast` -> `DURATION_FAST` (Kotlin `const val`). */
export const constantName = (name: string): string => name.replace(/-/g, '_').toUpperCase()

/** `surface-0` -> `monkiSurface0` (SwiftUI `Color` extension member). */
export const swiftColorName = (name: string): string => `monki${pascalName(name)}`

/**
 * Prefix of every CSS custom property. The extension injects its styles into
 * third-party pages, so unprefixed names could collide with the page's own.
 */
export const CSS_PREFIX = 'mf'

/** `surface-0` -> `--mf-surface-0`. */
export const cssVariableName = (name: string): string => `--${CSS_PREFIX}-${name}`
