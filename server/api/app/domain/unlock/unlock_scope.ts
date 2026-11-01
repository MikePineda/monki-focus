// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  SCOPE_APP_MAX_LENGTH,
  SCOPE_APP_PATTERN,
  SCOPE_DOMAIN_MAX_LENGTH,
  SCOPE_DOMAIN_PATTERN,
  SCOPE_PATH_MAX_LENGTH,
  SCOPE_PATH_PATTERN,
  type UnlockScope,
} from '@monki-focus/protocol'
import { refuse, succeed, type Outcome } from '#domain/outcome'

/**
 * What an unlock request may ask for: exactly one domain, path or app, in
 * the formats of the unlock token's `scope` claim. `kind: "rule"` (lift a
 * whole rule) is out of v1. Only the members of the kind are kept.
 */
export type ScopeRefusal = 'scope_kind' | 'scope_value'

export function checkUnlockScope(raw: {
  readonly kind: string
  readonly value: string
  readonly includeSubdomains?: boolean
}): Outcome<UnlockScope, ScopeRefusal> {
  const { kind, value } = raw
  if (kind === 'domain') {
    if (typeof raw.includeSubdomains !== 'boolean') return refuse('scope_value')
    if (value.length > SCOPE_DOMAIN_MAX_LENGTH || !SCOPE_DOMAIN_PATTERN.test(value)) {
      return refuse('scope_value')
    }
    return succeed({ kind, value, includeSubdomains: raw.includeSubdomains })
  }
  if (kind === 'path') {
    if (value.length > SCOPE_PATH_MAX_LENGTH || !SCOPE_PATH_PATTERN.test(value)) {
      return refuse('scope_value')
    }
    return succeed({ kind, value })
  }
  if (kind === 'app') {
    if (value.length > SCOPE_APP_MAX_LENGTH || !SCOPE_APP_PATTERN.test(value)) {
      return refuse('scope_value')
    }
    return succeed({ kind, value })
  }
  return refuse('scope_kind')
}

/**
 * What the guardian is shown of a scope: the host or the app, never a
 * path (a path can name a specific post or video).
 */
export function scopeTarget(scope: UnlockScope): { kind: UnlockScope['kind']; target: string } {
  return {
    kind: scope.kind,
    target: scope.kind === 'path' ? scope.value.split('/')[0] : scope.value,
  }
}
