// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto'
import type { KeyPurpose } from '@monki-focus/protocol'

/** Kids per key purpose, as a heartbeat reports them and `GET /keys` publishes them. */
export type KidsByPurpose = Readonly<Record<KeyPurpose, readonly string[]>>

export interface KeyPinVerdict {
  /** True when the device pins a kid this instance does not publish. */
  readonly mismatch: boolean
  /** The pinned kids the instance does not know, purpose by purpose (sorted, unique). */
  readonly unknown: KidsByPurpose
}

const PURPOSES: readonly KeyPurpose[] = ['unlock', 'policy']

/**
 * Compares the kids a device pins with the keys this instance publishes
 * (active and retired, per purpose). Every pinned kid must be a key of the
 * instance for its purpose: a kid it never published means the device was
 * enrolled through something that swapped the keys (an intercepting proxy)
 * or pins a key since pruned, and the guardian hears of it
 * (`key_pin_mismatch`, docs/protocol/unlock-tokens.md §2). Pinning only an
 * older, still published key is fine: the device has not rotated yet.
 */
export function checkKeyPins(pinned: KidsByPurpose, published: KidsByPurpose): KeyPinVerdict {
  const unknown = Object.fromEntries(
    PURPOSES.map((purpose) => {
      const known = new Set(published[purpose])
      const strangers = [...new Set(pinned[purpose].filter((kid) => !known.has(kid)))].sort()
      return [purpose, strangers]
    })
  ) as Record<KeyPurpose, string[]>
  return { mismatch: PURPOSES.some((purpose) => unknown[purpose].length > 0), unknown }
}

/** The kids of a published key set (`GET /keys`), per purpose, in publication order. */
export function kidsByPurpose(
  keys: ReadonlyArray<{ readonly kid: string; readonly purpose: KeyPurpose }>
): KidsByPurpose {
  return {
    unlock: keys.filter((key) => key.purpose === 'unlock').map((key) => key.kid),
    policy: keys.filter((key) => key.purpose === 'policy').map((key) => key.kid),
  }
}

/**
 * A short, stable fingerprint of a pinned set (order and duplicates do not
 * matter), so one mismatching set raises one event and a different set
 * raises another.
 */
export function pinnedSetFingerprint(pinned: KidsByPurpose): string {
  const canonical = PURPOSES.map(
    (purpose) => `${purpose}=${[...new Set(pinned[purpose])].sort().join(',')}`
  )
  return createHash('sha256').update(canonical.join(';')).digest('base64url').slice(0, 16)
}
