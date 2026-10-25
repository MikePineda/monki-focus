// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BridgeBrowser } from './BridgeContract'

interface NavigatorLike {
  brave?: unknown
  userAgentData?: { brands?: readonly { brand: string }[] }
}

/**
 * The browser the extension runs in, for the app's web bucket name. Brave
 * exposes `navigator.brave` (its user agent string says Chrome); Chrome
 * names itself in the user agent brands.
 */
export function browserKind(navigator: object): BridgeBrowser {
  // `brave` and `userAgentData` are not in the DOM typings Navigator has here.
  const candidate = navigator as NavigatorLike
  if (typeof candidate.brave === 'object' && candidate.brave !== null) return 'brave'
  const brands = candidate.userAgentData?.brands ?? []
  return brands.some((entry) => entry.brand === 'Google Chrome') ? 'chrome' : 'other'
}
