// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Normalisation of rule targets, shared by validation (uniqueness, domain
 * checks) and described for every engine in SEMANTICS.md §3.1. Pure: the
 * alias map (alias domain → canonical domain) comes from the site profiles.
 */

export type AliasMap = Readonly<Record<string, string>>

/** Second-level labels that, under a two-letter country TLD, form a public suffix (`co.uk`). */
const PUBLIC_SECOND_LEVEL_LABELS = new Set(['ac', 'co', 'com', 'edu', 'gov', 'net', 'org'])

/** Drops one leading `www.` or `m.` label, then rewrites an alias suffix to its canonical domain. */
export function normaliseDomain(domain: string, aliases: AliasMap = {}): string {
  let host = domain.toLowerCase()
  if (host.startsWith('www.') || host.startsWith('m.')) host = host.slice(host.indexOf('.') + 1)
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (host === alias) return canonical
    if (host.endsWith(`.${alias}`)) return `${host.slice(0, -alias.length)}${canonical}`
  }
  return host
}

/** A normalised domain needs two labels and must not be a bare public suffix such as `co.uk`. */
export function isRegistrableDomain(domain: string, aliases: AliasMap = {}): boolean {
  const labels = normaliseDomain(domain, aliases).split('.')
  if (labels.length < 2) return false
  const [second, top] = labels.slice(-2)
  const isPublicSuffix =
    labels.length === 2 &&
    top !== undefined &&
    top.length === 2 &&
    second !== undefined &&
    PUBLIC_SECOND_LEVEL_LABELS.has(second)
  return !isPublicSuffix
}

/**
 * The value two targets are compared by for uniqueness: normalised domain,
 * lower-cased glob (globs compare case-insensitively) and `/**` as no path.
 * Values that are not site targets are returned unchanged.
 */
export function canonicalTarget(value: unknown, aliases: AliasMap = {}): unknown {
  if (value === null || typeof value !== 'object') return value
  const target = value as Record<string, unknown>
  if (target.kind !== 'site' || typeof target.domain !== 'string') return value
  const canonical: Record<string, unknown> = {
    kind: 'site',
    domain: normaliseDomain(target.domain, aliases),
  }
  if (typeof target.path === 'string' && target.path !== '/**') {
    canonical.path = target.path.toLowerCase()
  }
  return canonical
}
