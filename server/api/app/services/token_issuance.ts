// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { UUID_PATTERN, type IsRegistrableDomain } from '@monki-focus/protocol'
import { refuse, succeed, type Outcome } from '#domain/outcome'
import {
  issuePolicy,
  type IssuedPolicyToken,
  type PolicyGrant,
  type PolicyIssueFailure,
} from '#domain/unlock/policy_token_issuer'
import {
  issueTime,
  type IssuedTimeToken,
  type TimeIssueFailure,
  type TimeRequest,
} from '#domain/unlock/time_token_issuer'
import {
  issueUnlock,
  type IssuedUnlockToken,
  type UnlockGrant,
  type UnlockIssueFailure,
} from '#domain/unlock/unlock_token_issuer'
import type { RevocationFailure, UnlockLedgerEntry } from '#domain/unlock/unlock_token_ledger'
import type SigningKeyStore from '#services/signing_key_store'
import type { TokenIssuerIdentity } from '#services/token_issuer_identity'
import type UnlockTokenLedgerStore from '#services/unlock_token_ledger_store'

export interface TokenIssuanceOptions {
  readonly keys: SigningKeyStore
  readonly ledger: UnlockTokenLedgerStore
  readonly identity: TokenIssuerIdentity
  /** Server time in whole epoch seconds. */
  readonly now: () => number
  /** `unlockLifetimeCapSeconds(UNLOCK_TOKEN_MAX_MINUTES)`. */
  readonly lifetimeCapSeconds: number
  readonly isRegistrableDomain: IsRegistrableDomain
  readonly newTokenId?: () => string
}

/**
 * The one place the server signs tokens (for the device and unlock routes
 * of S4 and S6): it takes the active key of the right purpose, runs the
 * pure issuers of app/domain/unlock and records every unlock token in the
 * ledger in the same transaction. Tokens are returned to the caller and
 * never logged.
 */
export default class TokenIssuance {
  readonly #options: TokenIssuanceOptions
  readonly #newTokenId: () => string

  constructor(options: TokenIssuanceOptions) {
    this.#options = options
    this.#newTokenId = options.newTokenId ?? randomUUID
  }

  /**
   * Signs an unlock token and records it in the ledger. Pass the caller's
   * transaction (the approval that locked the request) so the ledger row
   * commits or rolls back with the decision.
   */
  async issueUnlock(
    grant: UnlockGrant,
    trx?: TransactionClientContract
  ): Promise<Outcome<IssuedUnlockToken, UnlockIssueFailure>> {
    const { keys, ledger, identity } = this.#options
    const signingKey = await keys.signingKey('unlock')
    const issued = issueUnlock(grant, {
      ...identity,
      signingKey,
      now: this.#options.now(),
      lifetimeCapSeconds: this.#options.lifetimeCapSeconds,
      isRegistrableDomain: this.#options.isRegistrableDomain,
      newTokenId: this.#newTokenId,
    })
    if (!issued.ok) return issued
    if (trx === undefined) {
      await db.transaction((own) => ledger.record(issued.value.ledger, own))
    } else {
      await ledger.record(issued.value.ledger, trx)
    }
    return succeed(issued.value)
  }

  async issuePolicy(grant: PolicyGrant): Promise<Outcome<IssuedPolicyToken, PolicyIssueFailure>> {
    return issuePolicy(grant, {
      ...this.#options.identity,
      signingKey: await this.#options.keys.signingKey('policy'),
      now: this.#options.now(),
      newTokenId: this.#newTokenId,
    })
  }

  /** Signs the answer to a heartbeat or unlock poll, with the device's pending revocations. */
  async issueTime(request: TimeRequest): Promise<Outcome<IssuedTimeToken, TimeIssueFailure>> {
    const now = this.#options.now()
    const revocations = await this.#options.ledger.pendingRevocationsFor(request.deviceUuid, now)
    return issueTime(request, revocations, {
      ...this.#options.identity,
      signingKey: await this.#options.keys.signingKey('unlock'),
      now,
    })
  }

  async revokeUnlock(
    jti: string
  ): Promise<Outcome<UnlockLedgerEntry, RevocationFailure | 'unknown_token'>> {
    if (!UUID_PATTERN.test(jti)) {
      return refuse('unknown_token')
    }
    return this.#options.ledger.revoke(jti, this.#options.now())
  }
}
