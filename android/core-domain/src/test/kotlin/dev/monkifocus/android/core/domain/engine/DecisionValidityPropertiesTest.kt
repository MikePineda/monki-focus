// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.fixtures.RulesPackage
import dev.monkifocus.android.core.domain.rules.DecisionState
import dev.monkifocus.android.core.domain.rules.Observation
import dev.monkifocus.android.core.domain.rules.Ruleset
import org.junit.Assert.assertEquals
import org.junit.Test
import kotlin.random.Random

/**
 * `validUntil` (SEMANTICS.md §5.6) against a brute-force oracle that knows
 * nothing about schedules, bedtime, midnights or DST: it evaluates the
 * decision at every whole UTC minute of the next 24 hours (wall-clock rules
 * can only change at a whole minute in every real zone) and at every instant
 * the state names, and keeps the first one at which the decision differs.
 * The Kotlin twin of `DecisionValidityProperties.test.ts`, over seeded inputs.
 */
class DecisionValidityPropertiesTest {
    private val catalog = RulesPackage.catalog

    /** Days around the 2026 DST transitions of London and Sydney (UTC and Honolulu have none). */
    private val weeks =
        listOf("2026-03-27T00:00:00Z", "2026-04-03T00:00:00Z", "2026-10-02T00:00:00Z", "2026-10-23T00:00:00Z").map(::epochSecondsOf)

    private fun nowFrom(random: Random): String = utcInstantOf(weeks[random.nextInt(weeks.size)] + random.nextLong(3 * DAY + 1))

    private fun stateInstants(state: DecisionState): List<Long> =
        state.unlocks.flatMap { listOf(epochSecondsOf(it.notBefore), epochSecondsOf(it.expiresAt)) } +
            state.escalation.flatMap { escalation ->
                listOfNotNull(
                    escalation.intentionExpiresAt?.let(::epochSecondsOf),
                    escalation.overrideEndsAt?.let(::epochSecondsOf),
                    escalation.lastActivityAt?.let { epochSecondsOf(it) + QUIET },
                )
            }

    private fun oracle(
        ruleset: Ruleset,
        observation: Observation,
        state: DecisionState,
        now: String,
    ): String {
        val (inputs, nowSeconds) = decisionInputsOf(ruleset, observation, state, now, catalog)
        val first = decisionAt(inputs, nowSeconds)
        val pending = state.pendingEffectiveFrom?.let(::epochSecondsOf)
        val horizon = if (pending != null && pending > nowSeconds) minOf(nowSeconds + DAY, pending) else nowSeconds + DAY
        val minutes = generateSequence(Math.floorDiv(nowSeconds + 1 + 59, 60L) * 60) { it + 60 }.takeWhile { it <= horizon }
        val change =
            (minutes.toList() + stateInstants(state))
                .filter { it > nowSeconds && it <= horizon }
                .sorted()
                .firstOrNull { decisionAt(inputs, it) != first }
        return utcInstantOf(change ?: horizon)
    }

    @Test
    fun valid_until_is_the_first_instant_the_decision_changes() {
        for (seed in 0 until 80) {
            val random = Random(seed)
            val arbitrary = DecisionArbitraries(random)
            val ruleset = arbitrary.ruleset()
            val observation = arbitrary.observation()
            val now = nowFrom(random)
            val pendingIn = if (random.nextBoolean()) null else random.nextLong(-3600, 2 * DAY + 1)
            val state =
                arbitrary.decisionState().copy(pendingEffectiveFrom = pendingIn?.let { utcInstantOf(epochSecondsOf(now) + it) })

            val decision = decide(ruleset, observation, state, now, catalog)

            assertEquals("seed $seed", oracle(ruleset, observation, state, now), decision.validUntil)
        }
    }

    @Test
    fun the_decision_holds_until_valid_until() {
        for (seed in 0 until 300) {
            val random = Random(seed + 10_000)
            val arbitrary = DecisionArbitraries(random)
            val ruleset = arbitrary.ruleset()
            val observation = arbitrary.observation()
            val state = arbitrary.decisionState()
            val now = nowFrom(random)

            val decision = decide(ruleset, observation, state, now, catalog)
            val validUntil = requireNotNull(decision.validUntil) { "seed $seed" }
            val start = epochSecondsOf(now)
            val later = start + (((epochSecondsOf(validUntil) - start - 1) * random.nextDouble()).toLong())
            val actual = decide(ruleset, observation, state, utcInstantOf(later), catalog)

            assertEquals("seed $seed", decision.copy(validUntil = null), actual.copy(validUntil = null))
        }
    }

    private companion object {
        const val DAY = 86_400L
        const val QUIET = 7200L
    }
}
