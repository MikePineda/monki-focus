// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * `includeSubdomains: true` is allowed only on a value that is at least a
 * registrable domain (eTLD+1, Public Suffix List), so an unlock can never
 * cover `co.uk`, `github.io` or `blogspot.com` and with them every site
 * below. Issuers MUST check this server-side against the full Public Suffix
 * List and inject that check here; the protocol package does not vendor the
 * list. Clients cannot check it (they have no list), which is why the issuer
 * is responsible.
 */
export type IsRegistrableDomain = (domain: string) => boolean

/**
 * A checker from a plain list of public suffixes (exact rules plus the PSL
 * default rule that every single label is a suffix; no wildcard or exception
 * rules). Enough for tests and small embedded lists, not for production.
 */
export function registrableDomainCheck(publicSuffixes: readonly string[]): IsRegistrableDomain {
  const suffixes = new Set(publicSuffixes)
  return (domain) => domain.includes('.') && !suffixes.has(domain)
}
