// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Client-side key rotation (spec §2): a client adopts a new key only when
 * its endorsement verifies strictly against a key it already pins. It then
 * keeps exactly the endorsing key and the new key, and drops any other, so
 * a keyring never holds more than two keys and never a key that no pinned
 * key vouched for.
 */
import type { IssuerProfile } from './implicit_assertion.ts'
import { createKeyring, type Keyring, type PinnedKey } from './keyring.ts'
import { fail, ok, type Result } from './token_error.ts'
import type { KeyPurpose } from './token_purpose.ts'
import { verifyKeyEndorsement } from './verify_key_endorsement.ts'

export interface KeyAdoptionContext {
  readonly issuer: string
  /** Trusted now, in whole epoch seconds. */
  readonly now: number
  readonly issuerProfile?: IssuerProfile
}

export interface AdoptedKeys {
  /** What to persist as the new pinned set: the endorsing key, then the new key. */
  readonly pinned: readonly PinnedKey[]
  readonly keyring: Keyring
}

export function adoptEndorsedKey(
  purpose: KeyPurpose,
  pinned: readonly PinnedKey[],
  endorsement: unknown,
  context: KeyAdoptionContext
): Result<AdoptedKeys> {
  try {
    const current = createKeyring(purpose, pinned)
    if (!current.ok) {
      return current
    }
    const verified = verifyKeyEndorsement(endorsement, { ...context, keyring: current.value })
    if (!verified.ok) {
      return verified
    }
    const endorser = pinned.find((key) => key.kid === verified.value.endorserKid)
    if (endorser === undefined) {
      return fail('internal_error')
    }
    const next = [endorser, verified.value.endorsed]
    const keyring = createKeyring(purpose, next)
    return keyring.ok ? ok({ pinned: next, keyring: keyring.value }) : keyring
  } catch {
    return fail('internal_error')
  }
}
