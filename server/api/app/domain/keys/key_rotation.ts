// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  encodeBase64Url,
  formatRfc3339Utc,
  issueKeyEndorsement,
  KEY_ENDORSEMENT_MAX_LIFETIME_SECONDS,
  type IssuerProfile,
  type KeyPurpose,
} from '@monki-focus/protocol'
import { refuse, succeed, type Outcome } from '#domain/outcome'
import { activeKeyOf, retiredKeysOf } from '#domain/keys/key_ring'
import type { SigningKeyRecord } from '#domain/keys/signing_key_record'
import type { SigningKeyMaterial } from '#domain/keys/signing_key_material'

export type KeyRotationFailure =
  /** A retired key is still published: a third verifiable key would break the two-key rule. */
  | 'retired_key_pending'
  /** The successor is already a key of this instance. */
  | 'successor_already_known'
  /** The successor or the endorser belongs to another purpose. */
  | 'purpose_mismatch'
  /** The endorsing key is not the active key of the purpose. */
  | 'endorser_not_active'
  /** The endorsement could not be signed (a protocol rule refused it). */
  | 'endorsement_refused'

export interface KeyRotationInput {
  readonly purpose: KeyPurpose
  readonly records: readonly SigningKeyRecord[]
  /** The new key. */
  readonly successor: Pick<SigningKeyMaterial, 'kid' | 'purpose' | 'publicKey'>
  /**
   * The active key's private material, to endorse the successor. `null` only
   * for an unendorsed rotation (the active key is lost or compromised): then
   * every device has to be enrolled again to pin the new key.
   */
  readonly endorser: SigningKeyMaterial | null
  readonly issuer: string
  readonly profile: IssuerProfile
  /** Epoch seconds. */
  readonly now: number
}

export interface KeyRotationPlan {
  /** The active key that becomes `retired`, or null for the first key of a purpose. */
  readonly retireKid: string | null
  /** Endorsement of the successor by the retiring key, or null (first key, unendorsed). */
  readonly endorsement: string | null
}

/** How long an endorsement is offered: the longest the protocol allows (90 days). */
export const ENDORSEMENT_LIFETIME_SECONDS = KEY_ENDORSEMENT_MAX_LIFETIME_SECONDS

/**
 * Plans one rotation of a purpose: the active key retires and endorses its
 * successor (spec §2), so clients that pin the old key adopt the new one
 * offline. Refused while a retired key of the purpose is still published
 * (prune it first): the server never offers more than two verifiable keys.
 */
export function planKeyRotation(
  input: KeyRotationInput
): Outcome<KeyRotationPlan, KeyRotationFailure> {
  const { purpose, records, successor, endorser, now } = input
  if (successor.purpose !== purpose) return refuse('purpose_mismatch')
  if (records.some((record) => record.kid === successor.kid)) {
    return refuse('successor_already_known')
  }
  if (retiredKeysOf(records, purpose).length > 0) return refuse('retired_key_pending')

  const active = activeKeyOf(records, purpose)
  if (active === undefined) return succeed({ retireKid: null, endorsement: null })
  if (endorser === null) return succeed({ retireKid: active.kid, endorsement: null })
  if (endorser.purpose !== purpose) return refuse('purpose_mismatch')
  if (endorser.kid !== active.kid) return refuse('endorser_not_active')

  const iat = formatRfc3339Utc(now)
  const endorsement = issueKeyEndorsement(
    {
      v: 1,
      typ: 'key',
      iss: input.issuer,
      use: purpose,
      kid: successor.kid,
      x: encodeBase64Url(successor.publicKey),
      iat,
      nbf: iat,
      exp: formatRfc3339Utc(now + ENDORSEMENT_LIFETIME_SECONDS),
    },
    endorser,
    { profile: input.profile }
  )
  if (!endorsement.ok) return refuse('endorsement_refused')
  return succeed({ retireKid: active.kid, endorsement: endorsement.value })
}
