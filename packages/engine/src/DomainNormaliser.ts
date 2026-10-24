// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Host and domain normalisation (SEMANTICS.md §2 steps 5–6, §3.1): lower-case,
 * drop one trailing `.`, drop one leading `www.` or `m.` label, then rewrite a
 * site-profile alias suffix to its canonical domain (`mobile.twitter.com` →
 * `mobile.x.com`). Rule, category and unlock domains go through the same steps,
 * so a rule on `twitter.com` acts on `x.com`.
 */

/** Alias domain → canonical domain, longest alias first so the most specific suffix wins. */
export type AliasTable = readonly (readonly [alias: string, canonical: string])[]

export function aliasTableOf(aliases: Readonly<Record<string, string>>): AliasTable {
  return Object.entries(aliases).sort(([a], [b]) =>
    b.length !== a.length ? b.length - a.length : a < b ? -1 : 1
  )
}

/** Steps 5 (without validation) and 6 for an ASCII host or a rule domain. */
export function normaliseDomain(domain: string, aliases: AliasTable): string {
  let host = domain.toLowerCase()
  if (host.endsWith('.')) host = host.slice(0, -1)
  if (host.startsWith('www.') || host.startsWith('m.')) host = host.slice(host.indexOf('.') + 1)
  for (const [alias, canonical] of aliases) {
    if (host === alias) return canonical
    if (host.endsWith(`.${alias}`)) return `${host.slice(0, -alias.length)}${canonical}`
  }
  return host
}

/** `host` equals `domain` or is one of its subdomains. */
export function isDomainOrSubdomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

export function domainLabelCount(domain: string): number {
  return domain.split('.').length
}
