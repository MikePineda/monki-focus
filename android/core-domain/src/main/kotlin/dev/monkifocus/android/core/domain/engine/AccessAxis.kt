// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.SurfaceKind
import dev.monkifocus.android.core.domain.rules.SurfaceTarget

/*
 * The access axis (SEMANTICS.md §5.1, §5.5): `allow`, `friction` and `block`
 * candidates compete and the most specific wins (§4). With an unknown path the
 * candidates are every rule of the host's domain and profile, each with an
 * **effective** mode (a `hide-feed` rule that can cover a feed surface and a
 * surface `block` count as `friction`), and the strictest effective mode wins,
 * ties by §4. Unknown paths therefore never fail open.
 */

/** The modes that compete on the access axis, in strictness order. */
internal enum class AccessMode { ALLOW, FRICTION, BLOCK }

internal data class AccessCandidate(
    val rule: Rule,
    val mode: AccessMode,
)

private fun accessModeOf(mode: RuleMode): AccessMode? =
    when (mode) {
        RuleMode.ALLOW -> AccessMode.ALLOW
        RuleMode.FRICTION -> AccessMode.FRICTION
        RuleMode.BLOCK -> AccessMode.BLOCK
        RuleMode.HIDE_FEED -> null
    }

/** §5.5: the mode an unknown-path candidate competes with on the access axis, if any. */
private fun unknownPathMode(
    rule: Rule,
    host: String,
    catalog: RulesCatalog,
): AccessMode? {
    val target = rule.target
    if (rule.mode == RuleMode.HIDE_FEED) {
        val coversFeed =
            if (target is SurfaceTarget) {
                catalog.surfaceKind(target.surface) == SurfaceKind.FEED
            } else {
                catalog.profileForHost(host)?.surfaces?.any { catalog.surfaceKind(it.surface) == SurfaceKind.FEED } ?: false
            }
        return if (coversFeed) AccessMode.FRICTION else null
    }
    // Remove the feed, not the tool: a surface block gates; a site block stays a block.
    if (rule.mode == RuleMode.BLOCK && target is SurfaceTarget) return AccessMode.FRICTION
    return accessModeOf(rule.mode)
}

/**
 * Access candidates with their effective modes. `candidates` are the matching
 * rules (known path) or the unknown-path candidates of §5.5.
 */
internal fun accessCandidates(
    candidates: List<Rule>,
    observation: ResolvedObservation,
    catalog: RulesCatalog,
): List<AccessCandidate> {
    if (observation is ResolvedObservation.Site && !observation.pathKnown) {
        return candidates.mapNotNull { rule -> unknownPathMode(rule, observation.host, catalog)?.let { AccessCandidate(rule, it) } }
    }
    return candidates.mapNotNull { rule -> accessModeOf(rule.mode)?.let { AccessCandidate(rule, it) } }
}

/** The access winner: most specific (§4), after the strictest effective mode on an unknown path. */
internal fun accessWinner(
    candidates: List<AccessCandidate>,
    unknownPath: Boolean,
    catalog: RulesCatalog,
): AccessCandidate? =
    candidates.minWithOrNull { a, b ->
        (if (unknownPath) b.mode.ordinal - a.mode.ordinal else 0).takeIf { it != 0 } ?: compareRules(a.rule, b.rule, catalog)
    }
