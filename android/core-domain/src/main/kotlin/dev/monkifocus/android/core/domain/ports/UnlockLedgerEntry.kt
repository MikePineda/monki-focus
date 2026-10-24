// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

import dev.monkifocus.android.core.domain.engine.epochSecondsOf

/**
 * One replay-store entry keyed by the token's [jti] (`unlock-tokens.md` §8).
 * The raw token is never stored here. [window] is null only for a revocation
 * of a jti this device never received; [stale] is set by an incomplete
 * revocation list and cleared by revalidation. [exp] drives the purge one day
 * after it.
 */
data class UnlockLedgerEntry(
    val jti: String,
    val status: UnlockStatus,
    val exp: String,
    val window: UnlockWindow?,
    val receipt: MonoBinding?,
    val activation: UnlockActivation?,
    val stale: Boolean,
) {
    init {
        require(JTI.matches(jti)) { "jti must be a UUID" }
        epochSecondsOf(exp)
        require(window == null || window.exp == exp) { "The window's exp is the entry's exp" }
        require(activation == null || receipt != null) { "An activation needs a receipt" }
    }

    private companion object {
        val JTI = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    }
}
