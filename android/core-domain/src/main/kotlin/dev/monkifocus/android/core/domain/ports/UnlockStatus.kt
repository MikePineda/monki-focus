// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

/**
 * The states of a replay-store entry (`docs/protocol/unlock-tokens.md` §8):
 * `received → active → ended`, plus `revoked`, with their stored codes.
 */
enum class UnlockStatus(
    val code: String,
) {
    RECEIVED("received"),
    ACTIVE("active"),
    ENDED("ended"),
    REVOKED("revoked"),
    ;

    companion object {
        fun ofCode(code: String): UnlockStatus =
            entries.firstOrNull { it.code == code } ?: throw IllegalArgumentException("Unknown unlock status")
    }
}
