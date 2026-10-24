// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Whether an unlock `scope` covers what the user is opening (spec §4.5).
 *
 *   - `domain`: the host equals `value`; with `includeSubdomains: true`, a
 *     host ending in "." + `value` also matches. Never a parent domain.
 *   - `path`: the host equals the scope host exactly (never a subdomain) and
 *     the scope's segments are a prefix of the target's segments, compared
 *     case-sensitively and without percent-decoding (a scope cannot contain
 *     `%`, so an encoded target segment never matches).
 *   - `app`: the package name or bundle id is equal.
 *
 * The target host must already be normalised by the platform (lowercase,
 * A-label, no port, no trailing dot) and the path must be the parsed URL path
 * (dot segments already resolved, query and fragment removed); anything else
 * does not match, which fails closed.
 */
import { SCOPE_DOMAIN_PATTERN } from './claim_formats.ts'
import type { UnlockScope } from './unlock_claims.ts'

export type ScopeTarget =
  | { readonly kind: 'web'; readonly host: string; readonly path: string }
  | { readonly kind: 'app'; readonly id: string }

export function scopeMatches(scope: UnlockScope, target: ScopeTarget): boolean {
  if (scope.kind === 'app') {
    return target.kind === 'app' && target.id === scope.value
  }
  if (target.kind !== 'web' || !SCOPE_DOMAIN_PATTERN.test(target.host)) {
    return false
  }
  if (scope.kind === 'domain') {
    return (
      target.host === scope.value ||
      (scope.includeSubdomains && target.host.endsWith(`.${scope.value}`))
    )
  }
  const [scopeHost, ...scopeSegments] = scope.value.split('/')
  if (target.host !== scopeHost || !target.path.startsWith('/')) {
    return false
  }
  const targetSegments = target.path.slice(1).split('/')
  return scopeSegments.every((segment, index) => targetSegments[index] === segment)
}
