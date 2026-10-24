// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

/**
 * The local replay store for unlock tokens, keyed by `jti`
 * (`unlock-tokens.md` §8, phase 3). The ledger logic (receive, activate,
 * revoke, purge) is pure domain code; this port only persists its entries. A
 * jti is unique: inserting one that exists never overwrites it, so an `ended`
 * or `revoked` entry cannot be reset by receiving the token again.
 */
interface UnlockLedgerRepository {
    suspend fun get(jti: String): UnlockLedgerEntry?

    /** Every entry, sorted by jti. */
    suspend fun all(): List<UnlockLedgerEntry>

    /** Stores a new entry; answers false (and changes nothing) when the jti exists. */
    suspend fun insert(entry: UnlockLedgerEntry): Boolean

    /** Replaces the stored entry with the same jti; answers false when there is none. */
    suspend fun update(entry: UnlockLedgerEntry): Boolean

    /** Removes the entries of [jtis] (the purge); answers how many were removed. */
    suspend fun delete(jtis: List<String>): Int
}
