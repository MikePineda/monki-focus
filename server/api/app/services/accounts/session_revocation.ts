// SPDX-License-Identifier: AGPL-3.0-or-later
import type User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Ends every session of the user: `session_version = session_version + 1`
 * in one atomic UPDATE (never a read-modify-write of the model, which two
 * concurrent requests could both write back with the same number), then
 * reloads the model so the caller can re-stamp its own session when it
 * should survive. Call it after saving the user's other changes: the
 * reload drops unsaved ones.
 */
export async function revokeSessions(user: User, client?: TransactionClientContract) {
  await (client ?? db).from('users').where('id', user.id).increment('session_version', 1)
  await user.refresh()
  return user
}
