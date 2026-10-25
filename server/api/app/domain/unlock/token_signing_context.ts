// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IssuerProfile } from '@monki-focus/protocol'
import type { SigningKeyMaterial } from '#domain/keys/signing_key_material'

/** What every token issuer needs besides the claims' own inputs. */
export interface TokenSigningContext {
  /** Canonical origin of this instance (`iss`). */
  readonly issuer: string
  /** `release` (https only) in production; `development` also signs loopback http issuers. */
  readonly profile: IssuerProfile
  /** The active key of the purpose's key purpose (unlock for unlock and time tokens). */
  readonly signingKey: SigningKeyMaterial
  /** Server time, whole epoch seconds. */
  readonly now: number
}

/** Server time must be whole, non-negative epoch seconds; anything else is a bug upstream. */
export function isEpochSeconds(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}
