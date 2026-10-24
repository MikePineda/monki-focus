// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.FrictionType
import dev.monkifocus.android.core.domain.rules.Gate

/*
 * Gates (SEMANTICS.md §7.1): `level = min(attemptCount − 1, 3)`; base pause
 * L0 5 s, L1 15 s, L2 15 s, L3 15 s with a linked guardian and 60 s without;
 * `pauseSeconds = min(base << min(brokenCount, 4), 60)`. A typed intention
 * from L2, the guardian key only at L3 with a guardian. The friction type
 * rotates `countdown → breath → reflect → type-intention → countdown` and is
 * always the successor of the previous one, so it never repeats.
 */

internal const val MAX_ATTEMPT_COUNT = 1000
internal const val MAX_BROKEN_COUNT = 16
private const val MAX_PAUSE_SECONDS = 60
private const val MAX_PAUSE_DOUBLINGS = 4

internal fun nextFrictionType(previous: FrictionType?): FrictionType =
    when (previous) {
        null -> FrictionType.COUNTDOWN
        FrictionType.COUNTDOWN -> FrictionType.BREATH
        FrictionType.BREATH -> FrictionType.REFLECT
        FrictionType.REFLECT -> FrictionType.TYPE_INTENTION
        FrictionType.TYPE_INTENTION -> FrictionType.COUNTDOWN
    }

/** The level of the gate shown for the `attemptCount`-th attempt (0 attempts reads as L0). */
internal fun levelOf(attemptCount: Int): Int = (attemptCount - 1).coerceIn(0, 3)

internal fun pauseSecondsOf(
    level: Int,
    brokenCount: Int,
    guardianLinked: Boolean,
): Int {
    val base =
        when {
            level == 0 -> 5
            level == 3 && !guardianLinked -> 60
            else -> 15
        }
    return minOf(base shl minOf(brokenCount, MAX_PAUSE_DOUBLINGS), MAX_PAUSE_SECONDS)
}

/** A complete gate: pause, typing and guardian key as §7.1 requires at its level. */
internal fun fullGate(
    attemptCount: Int,
    brokenCount: Int,
    frictionType: FrictionType,
    guardianLinked: Boolean,
): Gate {
    val level = levelOf(attemptCount)
    return Gate(
        level = level,
        pauseSeconds = pauseSecondsOf(level, brokenCount, guardianLinked),
        frictionType = frictionType,
        requiresTypedIntention = level >= 2,
        requiresGuardianKey = level == 3 && guardianLinked,
    )
}

/** The short extension gate (§7.3 `extend`): the doubled pause, no typing and no key. */
internal fun extensionGate(
    attemptCount: Int,
    brokenCount: Int,
    frictionType: FrictionType,
    guardianLinked: Boolean,
): Gate =
    fullGate(attemptCount, brokenCount, frictionType, guardianLinked).copy(
        requiresTypedIntention = false,
        requiresGuardianKey = false,
    )
