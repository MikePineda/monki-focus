// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Who may become whose guardian once a pairing code checked out: never
 * oneself, and a ward and a guardian share at most one live (pending or
 * active) link. A ward may have several guardians.
 */
export type PairingRefusal = 'self' | 'already_linked'

export function pairingRefusal(pair: {
  readonly wardUserId: number
  readonly guardianUserId: number
  /** A pending or active link between the two already exists. */
  readonly pairAlreadyLinked: boolean
}): PairingRefusal | null {
  if (pair.wardUserId === pair.guardianUserId) return 'self'
  if (pair.pairAlreadyLinked) return 'already_linked'
  return null
}
