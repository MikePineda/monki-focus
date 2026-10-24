// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Content
import dev.monkifocus.android.core.domain.rules.ReasonCode
import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.SurfaceKind

/*
 * The content axis (SEMANTICS.md §5.3): `hide-feed` and `allow` candidates
 * compete (an allow rule speaks for both axes) and the most specific wins.
 * A `hide-feed` winner hides only a resolved `feed` surface; a permalink or a
 * utility surface, an unmapped path and an unknown path are always shown.
 */

private fun hideFeedOutcome(
    winner: Rule,
    observation: ResolvedObservation,
    catalog: RulesCatalog,
): ContentOutcome {
    if (observation is ResolvedObservation.Site && !observation.pathKnown) {
        return ContentOutcome(Content.SHOW, winner, ReasonCode.PATH_UNKNOWN_ALLOW)
    }
    return when (observation.surface?.let(catalog::surfaceKind)) {
        SurfaceKind.FEED -> ContentOutcome(Content.HIDE_FEED, winner, ReasonCode.RULE_MATCH)
        null -> ContentOutcome(Content.SHOW, winner, ReasonCode.NOT_A_FEED)
        else -> ContentOutcome(Content.SHOW, winner, ReasonCode.PERMALINK_NEVER_HIDDEN)
    }
}

/** `matching` are the enabled, scheduled rules whose target matches the observation. */
internal fun contentOutcome(
    matching: List<Rule>,
    observation: ResolvedObservation,
    catalog: RulesCatalog,
): ContentOutcome {
    val winner = mostSpecific(matching.filter { it.mode == RuleMode.HIDE_FEED || it.mode == RuleMode.ALLOW }, catalog)
    if (winner?.mode != RuleMode.HIDE_FEED) return ContentOutcome(Content.SHOW, winner, ReasonCode.RULE_MATCH)
    return hideFeedOutcome(winner, observation, catalog)
}
