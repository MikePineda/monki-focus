// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export type UserLockMode = 'update' | 'no key update' | 'key share'

/** Stronger first, so a user named twice gets the stronger lock. */
const STRENGTH: Record<UserLockMode, number> = { 'update': 3, 'no key update': 2, 'key share': 1 }

/**
 * The first locks every guardian flow takes: the users rows involved, in
 * ascending id order, before any link or code. Account deletion cascades
 * from a users row to its links and codes, so taking users first
 * everywhere is what keeps pairing, confirmation, revocation and deletion
 * from waiting on each other in a cycle. Answers the ids that still exist
 * (a deleted account is simply absent).
 *
 * - `update`: the account being deleted.
 * - `no key update`: a guardian whose second factor a flow depends on
 *   (link confirmation, turning two-factor off), so those two serialise.
 * - `key share`: a row a flow only references (inserting a link, an event
 *   or a notice); it blocks nothing but a deletion.
 */
export async function lockUserRows(
  trx: TransactionClientContract,
  rows: ReadonlyArray<{ id: number; mode: UserLockMode }>
): Promise<Set<number>> {
  const strongest = new Map<number, UserLockMode>()
  for (const { id, mode } of rows) {
    const current = strongest.get(id)
    if (!current || STRENGTH[mode] > STRENGTH[current]) strongest.set(id, mode)
  }
  const present = new Set<number>()
  for (const id of [...strongest.keys()].sort((left, right) => left - right)) {
    const locked = await trx.rawQuery<{ rows: unknown[] }>(
      `SELECT id FROM users WHERE id = ? FOR ${strongest.get(id)!.toUpperCase()}`,
      [id]
    )
    if (locked.rows.length > 0) present.add(id)
  }
  return present
}
