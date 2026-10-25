// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  formatRfc3339Utc,
  issueUnlockToken,
  UNLOCK_MAX_DURATION_SECONDS,
  UNLOCK_MIN_DURATION_SECONDS,
  type IsRegistrableDomain,
  type TokenErrorCode,
  type UnlockClaims,
  type UnlockScope,
} from '@monki-focus/protocol'
import { refuse, succeed, type Outcome } from '#domain/outcome'
import { isEpochSeconds, type TokenSigningContext } from '#domain/unlock/token_signing_context'
import { UNLOCK_TOKEN_PROTOCOL_CAP_SECONDS } from '#domain/unlock/unlock_lifetime'
import { unlockTokenHash, type UnlockLedgerEntry } from '#domain/unlock/unlock_token_ledger'

/** What a guardian approved, as the unlock token will state it. */
export interface UnlockGrant {
  /** The ward's user id on this instance (`sub`). */
  readonly subject: string
  /** Device uuid (`dev`). */
  readonly deviceUuid: string
  /** The rule being lifted (`rule`). */
  readonly rule: string
  readonly scope: UnlockScope
  /** Length of the unlock once activated (`dur_s`). */
  readonly durationSeconds: number
  /** The unlock request this token answers (`req`). */
  readonly requestUuid: string
  /** The device's policy hash when it asked (`pol`). */
  readonly policyHash: string
  /**
   * How long the token can be received and activated (`exp - iat`).
   * Defaults to the instance cap; never more than it, never less than
   * `durationSeconds`.
   */
  readonly validForSeconds?: number
}

export interface UnlockIssuerContext extends TokenSigningContext {
  /** `min(UNLOCK_TOKEN_MAX_MINUTES, 240)` minutes, in seconds (unlock_lifetime.ts). */
  readonly lifetimeCapSeconds: number
  /** Public Suffix List check (server-side only, spec §4.5). */
  readonly isRegistrableDomain: IsRegistrableDomain
  /** A fresh random UUID v4 for `jti`. */
  readonly newTokenId: () => string
}

export interface IssuedUnlockToken {
  readonly token: string
  readonly claims: UnlockClaims
  /** What to insert into `unlock_tokens`. */
  readonly ledger: UnlockLedgerEntry
}

export type UnlockIssueFailure =
  /** The context's key is not an unlock-signing key. */
  | 'wrong_key_purpose'
  /** `validForSeconds` above the instance cap (or the 4 h protocol cap). */
  | 'lifetime_over_cap'
  /** `durationSeconds` outside 60-7200 s or longer than the token's validity. */
  | 'duration_out_of_range'
  /** `includeSubdomains` on a public suffix (`co.uk`, `github.io`) or a non-registrable name. */
  | 'scope_not_registrable'
  /** Any rule the protocol issuer refuses (schema, formats, issuer profile). */
  | TokenErrorCode

/**
 * Signs the unlock token for an approved request (spec §4.1): `iat = nbf =
 * now`, `exp = now + validFor`, a fresh `jti`, every claim bound and the
 * canonical bytes signed by the active unlock key. Returns the ledger entry
 * to store with it. Pure: the clock and the id generator are inputs.
 */
export function issueUnlock(
  grant: UnlockGrant,
  context: UnlockIssuerContext
): Outcome<IssuedUnlockToken, UnlockIssueFailure> {
  const { now, signingKey } = context
  if (!isEpochSeconds(now)) return refuse('invalid_input')
  if (signingKey.purpose !== 'unlock') return refuse('wrong_key_purpose')

  const cap = Math.min(context.lifetimeCapSeconds, UNLOCK_TOKEN_PROTOCOL_CAP_SECONDS)
  const validFor = grant.validForSeconds ?? cap
  if (!Number.isSafeInteger(validFor) || validFor < 1 || validFor > cap) {
    return refuse('lifetime_over_cap')
  }
  const duration = grant.durationSeconds
  if (
    !Number.isSafeInteger(duration) ||
    duration < UNLOCK_MIN_DURATION_SECONDS ||
    duration > UNLOCK_MAX_DURATION_SECONDS ||
    duration > validFor
  ) {
    return refuse('duration_out_of_range')
  }
  if (
    grant.scope.kind === 'domain' &&
    grant.scope.includeSubdomains &&
    !context.isRegistrableDomain(grant.scope.value)
  ) {
    return refuse('scope_not_registrable')
  }

  const iat = formatRfc3339Utc(now)
  const claims: UnlockClaims = {
    v: 1,
    typ: 'unlock',
    iss: context.issuer,
    sub: grant.subject,
    dev: grant.deviceUuid,
    rule: grant.rule,
    scope: canonicalScope(grant.scope),
    dur_s: duration,
    iat,
    nbf: iat,
    exp: formatRfc3339Utc(now + validFor),
    jti: context.newTokenId(),
    req: grant.requestUuid,
    pol: grant.policyHash,
  }
  const signed = issueUnlockToken(claims, signingKey, {
    profile: context.profile,
    isRegistrableDomain: context.isRegistrableDomain,
  })
  if (!signed.ok) return refuse(signed.error.code)

  return succeed({
    token: signed.value,
    claims,
    ledger: {
      jti: claims.jti,
      requestUuid: claims.req,
      deviceUuid: claims.dev,
      kid: signingKey.kid,
      tokenHash: unlockTokenHash(signed.value),
      issuedAt: now,
      notBefore: now,
      expiresAt: now + validFor,
      revokedAt: null,
    },
  })
}

/** Copies only the members of the scope's kind, so no stray field reaches the claims. */
function canonicalScope(scope: UnlockScope): UnlockScope {
  return scope.kind === 'domain'
    ? { kind: 'domain', value: scope.value, includeSubdomains: scope.includeSubdomains }
    : { kind: scope.kind, value: scope.value }
}
