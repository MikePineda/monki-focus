// SPDX-License-Identifier: AGPL-3.0-or-later
import { getDomain } from 'tldts'
import { SCOPE_DOMAIN_PATTERN, type IsRegistrableDomain } from '@monki-focus/protocol'

/**
 * The server-side Public Suffix List check of unlock scopes (spec §4.5):
 * `includeSubdomains: true` only on a name that is at least a registrable
 * domain (eTLD+1). `tldts` ships the full list, private section included,
 * so `co.uk`, `github.io` and `blogspot.com` are refused while
 * `example.co.uk` and `project.github.io` pass. Only names in the exact
 * scope format are considered (lowercase labels, no empty label, no
 * trailing dot, never an IP literal), since `tldts` itself is lenient.
 */
export const isRegistrableDomain: IsRegistrableDomain = (domain) => {
  if (typeof domain !== 'string' || !SCOPE_DOMAIN_PATTERN.test(domain)) return false
  const registrable = getDomain(domain, {
    allowPrivateDomains: true,
    extractHostname: false,
    validateHostname: true,
  })
  return registrable !== null && (domain === registrable || domain.endsWith(`.${registrable}`))
}
