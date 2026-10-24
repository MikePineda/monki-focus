// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * `normalizeUrl(urlText, catalog)` (SEMANTICS.md §2): raw URL text, as a tab
 * or a mobile URL bar shows it, to `{host, path, pathKnown, surface}` or a
 * rejection. Parsing follows WHATWG URL semantics (`WhatwgUrl.ts`).
 */
import type { NormalizedUrl, RejectedUrl } from '@monki-focus/rules'
import { globShape, matchesGlob } from './PathGlob.ts'
import type { RulesCatalog } from './RulesCatalog.ts'
import { parseWhatwgUrl } from './WhatwgUrl.ts'

const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):/
const ESCAPE = /%([0-9A-Fa-f]{2})/g
const UNRESERVED = /^[A-Za-z0-9\-._~]$/
const TOP_LEVEL_LABEL = /^(?:[a-z]+|xn--[a-z0-9-]+)$/

function normaliseSegment(segment: string): string {
  return segment.replace(ESCAPE, (escape, hex: string) => {
    const character = String.fromCharCode(Number.parseInt(hex, 16))
    return UNRESERVED.test(character) ? character : `%${hex.toUpperCase()}`
  })
}

/** A segment that could disguise the real path makes the path unknown (step 7). */
function isAmbiguousSegment(segment: string): boolean {
  return segment.includes('%2F') || segment === '.' || segment === '..' || segment.includes(';')
}

function normaliseHost(hostname: string, catalog: RulesCatalog): string | null {
  const host = catalog.normaliseDomain(hostname)
  const labels = host.split('.')
  if (labels.length < 2 || labels.some((label) => label === '')) return null
  return TOP_LEVEL_LABEL.test(labels[labels.length - 1] ?? '') ? host : null
}

/** The most specific surface glob of the host's profile that matches the path (step 8). */
export function resolveSurface(host: string, path: string, catalog: RulesCatalog): string | null {
  const profile = catalog.profileForHost(host)
  if (profile === null) return null
  let best: { surface: string; literals: number; wildcards: number } | null = null
  for (const { surface, globs } of profile.surfaces) {
    for (const glob of globs.filter((candidate) => matchesGlob(candidate, path))) {
      const { literals, wildcards } = globShape(glob)
      const better =
        best === null ||
        literals > best.literals ||
        (literals === best.literals && wildcards < best.wildcards)
      if (better) best = { surface, literals, wildcards }
    }
  }
  return best?.surface ?? null
}

export function normalizeUrl(urlText: string, catalog: RulesCatalog): NormalizedUrl | RejectedUrl {
  const text = urlText.trim()
  const scheme = SCHEME.exec(text)?.[1]
  const hasScheme = scheme !== undefined && !scheme.includes('.')
  if (hasScheme && !['http', 'https'].includes(scheme.toLowerCase())) {
    return { rejected: 'not_http' }
  }
  let pathKnown = hasScheme || /[/?#]/.test(text)
  const url = parseWhatwgUrl(hasScheme ? text : `https://${text}`)
  const host = url === null ? null : normaliseHost(url.hostname, catalog)
  if (url === null || host === null) return { rejected: 'invalid_host' }
  const segments = url.pathname
    .split('/')
    .filter((segment) => segment !== '')
    .map(normaliseSegment)
  if (segments.some(isAmbiguousSegment)) pathKnown = false
  const path = `/${segments.join('/')}`
  return { host, path, pathKnown, surface: pathKnown ? resolveSurface(host, path, catalog) : null }
}
