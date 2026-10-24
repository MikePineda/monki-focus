// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Host and target-domain normalisation (SEMANTICS.md §2 steps 5–6, §3.1):
 * lower-case ASCII, one trailing `.` dropped, one leading `www.` or `m.`
 * label dropped, then a site profile alias suffix rewritten to its domain.
 */
import type { SiteProfile } from '@monki-focus/rules'

export function normaliseDomain(domain: string, siteProfiles: readonly SiteProfile[]): string {
  let host = domain.toLowerCase()
  if (host.endsWith('.')) host = host.slice(0, -1)
  if (host.startsWith('www.') || host.startsWith('m.')) host = host.slice(host.indexOf('.') + 1)
  for (const profile of siteProfiles) {
    for (const alias of profile.aliases) {
      if (host === alias) return profile.domain
      if (host.endsWith(`.${alias}`)) return `${host.slice(0, -alias.length)}${profile.domain}`
    }
  }
  return host
}

/** A host matches a domain when it equals it or is one of its subdomains. */
export function hostMatchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}
