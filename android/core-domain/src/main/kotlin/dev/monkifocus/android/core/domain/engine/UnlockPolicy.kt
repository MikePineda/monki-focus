// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.VerifiedUnlock

/**
 * Verified unlocks (SEMANTICS.md §5.2): an unlock whose target matches the
 * observation and with `notBefore ≤ now < expiresAt` lifts any restriction,
 * bedtime included. Adapters verify signature, device and replay before an
 * unlock reaches the engine; the engine only checks time and target.
 */
internal fun hasActiveUnlock(
    unlocks: List<VerifiedUnlock>,
    observation: ResolvedObservation,
    nowSeconds: Long,
    catalog: RulesCatalog,
): Boolean =
    unlocks.any { unlock ->
        epochSecondsOf(unlock.notBefore) <= nowSeconds &&
            nowSeconds < epochSecondsOf(unlock.expiresAt) &&
            matchesTarget(unlock.target, observation, catalog)
    }
