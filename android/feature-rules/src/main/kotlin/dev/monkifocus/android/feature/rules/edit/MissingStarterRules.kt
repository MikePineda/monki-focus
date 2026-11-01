// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.edit

import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.SurfaceTarget

/**
 * The starter preset's surface rules a stored rule set lacks: an install
 * keeps its stored set, so rules the preset gained later (a new site's
 * Reels or video feed) reach it only through "Add suggested rules". A rule
 * is missing when no stored rule has its id and no stored rule targets its
 * surface (the user's own rule on that surface stays the one that speaks).
 * Site rules of the preset are never suggested. Adding them only tightens,
 * so the rule-change policy applies them at once.
 */
object MissingStarterRules {
    fun of(
        stored: Ruleset,
        starter: Ruleset,
    ): List<Rule> {
        val ids = stored.rules.map { it.id }.toSet()
        val surfaces = stored.rules.mapNotNull { (it.target as? SurfaceTarget)?.surface }.toSet()
        return starter.rules.filter { rule ->
            val target = rule.target as? SurfaceTarget ?: return@filter false
            rule.id !in ids && target.surface !in surfaces
        }
    }

    /** [stored] with the missing starter rules appended, or [stored] itself when none is missing. */
    fun addTo(
        stored: Ruleset,
        starter: Ruleset,
    ): Ruleset {
        val missing = of(stored, starter)
        return if (missing.isEmpty()) stored else stored.copy(rules = stored.rules + missing)
    }
}
