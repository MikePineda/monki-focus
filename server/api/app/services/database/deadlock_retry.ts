// SPDX-License-Identifier: AGPL-3.0-or-later

/** Postgres deadlock_detected. */
const DEADLOCK_DETECTED = '40P01'

/**
 * Runs a whole transaction (`() => db.transaction(...)`) and, if Postgres
 * chose it as a deadlock victim, runs it once more: the victim was rolled
 * back entirely, and by then the other transaction holds or released what
 * it needed. A backstop only: the guardian flows take their locks in one
 * order (users rows, then links, then codes) so a cycle should not form.
 * Any other error, or a second deadlock, is thrown as is.
 */
export async function retryOnDeadlock<T>(transaction: () => Promise<T>): Promise<T> {
  try {
    return await transaction()
  } catch (error) {
    if ((error as { code?: unknown }).code !== DEADLOCK_DETECTED) throw error
    return transaction()
  }
}
