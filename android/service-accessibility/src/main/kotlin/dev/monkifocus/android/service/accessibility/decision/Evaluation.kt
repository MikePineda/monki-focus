// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.decision

import dev.monkifocus.android.core.domain.rules.Decision
import dev.monkifocus.android.core.domain.rules.Observation
import dev.monkifocus.android.core.domain.rules.Ruleset

/**
 * One `decide` call: its [decision], the [ruleset] it ran with (the cap rule
 * included; null when there was none and it failed closed) and the
 * [observation]. Lives for one event only: a site observation carries the
 * raw URL text, so it is never stored or printed.
 */
class Evaluation(
    val decision: Decision,
    val ruleset: Ruleset?,
    val observation: Observation,
) {
    override fun toString(): String = "Evaluation(${decision.access}, ${decision.reason.code})"
}
