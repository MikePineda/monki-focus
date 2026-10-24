// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import dev.monkifocus.android.core.domain.ports.MonoBinding
import dev.monkifocus.android.core.domain.ports.UnlockActivation
import dev.monkifocus.android.core.domain.ports.UnlockLedgerEntry
import dev.monkifocus.android.core.domain.ports.UnlockStatus
import dev.monkifocus.android.core.domain.ports.UnlockWindow

/**
 * One replay-store entry (`docs/protocol/unlock-tokens.md` §7, §8), keyed by
 * `jti`. The window, receipt and activation groups are each all-null or
 * all-set. The raw token is never stored in the database.
 */
@Entity(
    tableName = MonkiTables.UNLOCK_LEDGER,
    indices = [Index(value = ["exp_at"])],
)
data class UnlockLedgerEntity(
    @PrimaryKey val jti: String,
    val status: UnlockStatus,
    @ColumnInfo(name = "exp_at") val expAt: Long,
    @ColumnInfo(name = "iat_at") val iatAt: Long?,
    @ColumnInfo(name = "nbf_at") val nbfAt: Long?,
    @ColumnInfo(name = "dur_s") val durS: Int?,
    @ColumnInfo(name = "receipt_boot") val receiptBoot: String?,
    @ColumnInfo(name = "receipt_mono_ms") val receiptMonoMs: Long?,
    @ColumnInfo(name = "receipt_budget_ms") val receiptBudgetMs: Long?,
    @ColumnInfo(name = "activated_at") val activatedAt: Long?,
    @ColumnInfo(name = "activation_end_at") val activationEndAt: Long?,
    @ColumnInfo(name = "activation_boot") val activationBoot: String?,
    @ColumnInfo(name = "activation_mono_ms") val activationMonoMs: Long?,
    @ColumnInfo(name = "activation_budget_ms") val activationBudgetMs: Long?,
    val stale: Boolean,
) {
    fun toDomain(): UnlockLedgerEntry {
        val exp = instantOfMillis(expAt)
        val window =
            if (iatAt != null && nbfAt != null && durS != null) {
                UnlockWindow(instantOfMillis(iatAt), instantOfMillis(nbfAt), exp, durS)
            } else {
                null
            }
        val receipt =
            if (receiptBoot != null && receiptMonoMs != null && receiptBudgetMs != null) {
                MonoBinding(receiptBoot, receiptMonoMs, receiptBudgetMs)
            } else {
                null
            }
        val activation =
            if (activatedAt != null &&
                activationEndAt != null &&
                activationBoot != null &&
                activationMonoMs != null &&
                activationBudgetMs != null
            ) {
                UnlockActivation(
                    at = instantOfMillis(activatedAt),
                    end = instantOfMillis(activationEndAt),
                    mono = MonoBinding(activationBoot, activationMonoMs, activationBudgetMs),
                )
            } else {
                null
            }
        return UnlockLedgerEntry(jti, status, exp, window, receipt, activation, stale)
    }

    companion object {
        fun of(entry: UnlockLedgerEntry): UnlockLedgerEntity =
            UnlockLedgerEntity(
                jti = entry.jti,
                status = entry.status,
                expAt = millisOf(entry.exp),
                iatAt = entry.window?.let { millisOf(it.iat) },
                nbfAt = entry.window?.let { millisOf(it.nbf) },
                durS = entry.window?.durS,
                receiptBoot = entry.receipt?.boot,
                receiptMonoMs = entry.receipt?.monoAtMs,
                receiptBudgetMs = entry.receipt?.budgetMs,
                activatedAt = entry.activation?.let { millisOf(it.at) },
                activationEndAt = entry.activation?.let { millisOf(it.end) },
                activationBoot = entry.activation?.mono?.boot,
                activationMonoMs = entry.activation?.mono?.monoAtMs,
                activationBudgetMs = entry.activation?.mono?.budgetMs,
                stale = entry.stale,
            )
    }
}
