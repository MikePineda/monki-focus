// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * `normalizeUrl(urlText, siteProfiles)` of SEMANTICS.md §2, used by the tab
 * probe so a heartbeat carries the normalised domain, the path (never the
 * query or fragment) and the resolved surface.
 */
import type { NormalizedUrl, RejectedUrl, SiteProfile } from '@monki-focus/rules'
import { normaliseDomain } from './DomainNormaliser.ts'
import { resolveSurface } from './SurfaceResolver.ts'

const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):/
const HTTP_SCHEME = /^https?$/i
/** At least two labels and an alphabetic or punycode TLD (the schema's domain pattern). */
const DOMAIN = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/
const UNRESERVED = /^[A-Za-z0-9\-._~]$/
const ESCAPE = /%([0-9A-Fa-f]{2})/g

/** Decodes escapes of unreserved characters and upper-cases the hex of every other escape. */
function normaliseEscapes(segment: string): string {
  return segment.replace(ESCAPE, (escape, hex: string) => {
    const character = String.fromCharCode(parseInt(hex, 16))
    return UNRESERVED.test(character) ? character : escape.toUpperCase()
  })
}

/** A segment that could disguise the path: an encoded slash, a dot segment or matrix parameters. */
function disguisesPath(segment: string): boolean {
  return segment.includes('%2F') || segment.includes(';') || /^\.\.?$/.test(segment)
}

function parse(text: string): URL | null {
  try {
    return new URL(text)
  } catch {
    return null
  }
}

export function normalizeUrl(
  urlText: string,
  siteProfiles: readonly SiteProfile[]
): NormalizedUrl | RejectedUrl {
  const text = urlText.trim()
  const scheme = SCHEME.exec(text)?.[1]
  const hasScheme = scheme !== undefined && !scheme.includes('.')
  if (hasScheme && !HTTP_SCHEME.test(scheme)) return { rejected: 'not_http' }

  const url = parse(hasScheme ? text : `https://${text}`)
  const host = url === null ? '' : normaliseDomain(url.hostname, siteProfiles)
  if (url === null || !DOMAIN.test(host)) return { rejected: 'invalid_host' }

  const segments = url.pathname
    .split('/')
    .filter((segment) => segment !== '')
    .map(normaliseEscapes)
  const pathKnown = (hasScheme || /[/?#]/.test(text)) && !segments.some(disguisesPath)
  const path = `/${segments.join('/')}`
  return {
    host,
    path,
    pathKnown,
    surface: pathKnown ? resolveSurface(host, path, siteProfiles) : null,
  }
}
