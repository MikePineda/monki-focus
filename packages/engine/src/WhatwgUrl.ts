// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * WHATWG URL parsing through the `URL` global that Chromium service workers
 * and Node 24 both provide. The engine compiles without DOM or Node typings
 * (so neither can leak into `src/`), hence this narrow typed view of it.
 */

interface ParsedUrl {
  readonly hostname: string
  readonly pathname: string
}

type UrlConstructor = new (input: string) => ParsedUrl

const WhatwgUrlConstructor = (globalThis as unknown as { URL: UrlConstructor }).URL

/** The parsed URL, or null when WHATWG parsing fails. */
export function parseWhatwgUrl(text: string): ParsedUrl | null {
  try {
    return new WhatwgUrlConstructor(text)
  } catch {
    return null
  }
}
