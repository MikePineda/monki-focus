// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.AppObservation
import dev.monkifocus.android.core.domain.rules.DecisionState
import dev.monkifocus.android.core.domain.rules.Observation
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.SiteObservation

/*
 * Up-front checks of `decide`'s inputs (SEMANTICS.md §14): an invalid input
 * fails closed whichever path the decision would take, not only when a rule
 * happens to read it. Rule sets are schema-validated before they reach the
 * engine; this guards what changes at run time: the clock, the observation,
 * the escalation and unlock state, and the pinned zones.
 */

/** `decision-context.schema.json#/$defs/siteObservation`: `urlText` has 1 to 2048 code points. */
private const val MAX_URL_TEXT_CODE_POINTS = 2048

private val APP_PACKAGE = Regex("^[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z0-9_][A-Za-z0-9_-]*)+$")
private val SURFACE_ID = Regex("^[a-z][a-z0-9]*\\.[a-z][a-z0-9_]*$")

/** Thrown for an observation that fails its schema; `decide` fails closed on it. */
class InvalidObservationException : IllegalArgumentException("Malformed observation")

/**
 * Observations arrive from adapters at run time (accessibility events, URL
 * bars), so their schema is checked, not assumed: an input that fails its
 * schema fails closed (§14). Kotlin's types already rule out the wrong kinds.
 */
private fun assertObservation(observation: Observation) {
    val valid =
        when (observation) {
            is SiteObservation -> {
                observation.urlText.codePointCount(0, observation.urlText.length) in 1..MAX_URL_TEXT_CODE_POINTS
            }

            is AppObservation -> {
                observation.packageName.length <= 255 &&
                    APP_PACKAGE.matches(observation.packageName) &&
                    (observation.surface == null || (observation.surface.length <= 64 && SURFACE_ID.matches(observation.surface)))
            }
        }
    if (!valid) throw InvalidObservationException()
}

private fun assertStateInstants(state: DecisionState) {
    state.pendingEffectiveFrom?.let(::epochSecondsOf)
    for (unlock in state.unlocks) {
        epochSecondsOf(unlock.notBefore)
        epochSecondsOf(unlock.expiresAt)
    }
    for (escalation in state.escalation) {
        listOfNotNull(
            escalation.lastAttemptAt,
            escalation.lastActivityAt,
            escalation.pauseEndsAt,
            escalation.intentionExpiresAt,
            escalation.overrideReadyAt,
            escalation.overrideEndsAt,
        ).forEach(::epochSecondsOf)
    }
}

/**
 * The checks of the inputs every candidate computation reads (the clock, the
 * pinned zones, the observation); returns the instant in epoch seconds.
 */
internal fun guardCandidateInputs(
    ruleset: Ruleset,
    observation: Observation,
    at: String,
): Long {
    val seconds = epochSecondsOf(at)
    zonesOf(ruleset).forEach(::assertResolvableTimeZone)
    assertObservation(observation)
    return seconds
}

/** Throws on the first invalid input; returns `now` in epoch seconds. */
internal fun guardDecisionInputs(
    ruleset: Ruleset,
    observation: Observation,
    state: DecisionState,
    now: String,
): Long {
    val nowSeconds = guardCandidateInputs(ruleset, observation, now)
    assertStateInstants(state)
    return nowSeconds
}
