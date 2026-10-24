// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.fixtures

/**
 * Fixture kinds `:core-domain` runs: every kind of `packages/rules` except the
 * analytics kind (`activity`, a later work package) and `unlock-token`
 * (vectors live in `packages/protocol`). A new kind fails [RunnerCoverageTest].
 */
object RunnerKinds {
    val RUN_HERE = listOf("decision", "specificity", "url-normalize", "schedule", "escalation", "rule-change", "candidates", "invalid")

    val RUN_ELSEWHERE = listOf("activity", "unlock-token")

    /** `fixtures/` directories that are not kinds: `detectors/` holds the UI dumps `:detectors` replays. */
    val NOT_KINDS = listOf("detectors")
}
