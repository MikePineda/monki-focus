// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

import dev.monkifocus.android.core.domain.engine.epochSecondsOf

/**
 * The first activation of an unlock (`unlock-tokens.md` §7): its instant in
 * trusted time, the fixed end `min(at + dur_s, exp + 60 s)` that never moves
 * and the monotonic binding of the boot it happened in.
 */
data class UnlockActivation(
    val at: String,
    val end: String,
    val mono: MonoBinding,
) {
    init {
        require(epochSecondsOf(at) <= epochSecondsOf(end)) { "Activation ends before it starts" }
    }
}
