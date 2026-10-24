// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/**
 * `decision-context.schema.json#/$defs/verifiedUnlock`: an unlock whose token
 * an adapter already verified. The engine only checks its window and target.
 */
@Serializable
data class VerifiedUnlock(
    val target: Target,
    val notBefore: String,
    val expiresAt: String,
)
