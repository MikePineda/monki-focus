// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

/**
 * A monotonic binding (`unlock-tokens.md` §7): usable only in [boot], for at
 * most [budgetMs] of monotonic time after the reading [monoAtMs].
 */
data class MonoBinding(
    val boot: String,
    val monoAtMs: Long,
    val budgetMs: Long,
) {
    init {
        require(BOOT_ID.matches(boot)) { "Invalid boot id" }
        require(monoAtMs >= 0 && budgetMs >= 0) { "Monotonic values are non-negative" }
    }

    private companion object {
        val BOOT_ID = Regex("^[A-Za-z0-9._:-]{1,64}$")
    }
}
