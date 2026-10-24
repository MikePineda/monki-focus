// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

import dev.monkifocus.android.core.domain.engine.epochSecondsOf

/**
 * The verified token claims the replay store needs (`unlock-tokens.md` §4.1,
 * §7): server instants as UTC text and the granted duration in seconds.
 */
data class UnlockWindow(
    val iat: String,
    val nbf: String,
    val exp: String,
    val durS: Int,
) {
    init {
        require(epochSecondsOf(iat) <= epochSecondsOf(nbf) && epochSecondsOf(nbf) < epochSecondsOf(exp)) { "iat <= nbf < exp" }
        require(durS > 0) { "durS must be positive" }
    }
}
