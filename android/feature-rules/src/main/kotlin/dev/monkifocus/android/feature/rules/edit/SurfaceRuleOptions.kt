// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.edit

import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.Surface
import dev.monkifocus.android.core.domain.rules.SurfaceKind
import dev.monkifocus.android.core.domain.rules.SurfaceTarget

/**
 * What the "Add rule" picker offers, from the bundled surface registry (the
 * twin of the extension's `ADDABLE_SURFACES` / `addSurfaceRule`): an install
 * that kept an older rule set can still turn on rules the starter preset
 * gained later. Only `feed` surfaces are offered, with `hide-feed` or
 * `block`: a permalink or a utility (search, messages) is never hidden
 * (SEMANTICS.md §5.3), so a rule on one would mislead.
 */
class SurfaceRuleOptions(
    surfaces: List<Surface>,
) {
    private val feeds: List<Surface> = surfaces.filter { it.kind == SurfaceKind.FEED }

    /** Site families with at least one feed surface, in name order. */
    val families: List<String> = feeds.map { it.family }.distinct().sorted()

    /** The feed surfaces of [family], in registry order. */
    fun surfacesOf(family: String): List<Surface> = feeds.filter { it.family == family }

    companion object {
        /** The modes a feed surface rule can take. */
        val MODES: List<RuleMode> = listOf(RuleMode.HIDE_FEED, RuleMode.BLOCK)

        /** Short-video feeds (Reels, Shorts) start as `block`, like the starter preset; other feeds as `hide-feed`. */
        fun defaultMode(surface: Surface): RuleMode = if (surface.shortVideo) RuleMode.BLOCK else RuleMode.HIDE_FEED

        /** Adds an always-on, enabled rule on [surface] with [mode]; the id is `surface-<slug>`, made unique. */
        fun add(
            ruleset: Ruleset,
            surface: String,
            mode: RuleMode,
        ): Ruleset {
            val rule =
                Rule(
                    id = RulesetEdits.uniqueId(ruleset, "surface-${RulesetEdits.slug(surface)}"),
                    target = SurfaceTarget(surface),
                    mode = mode,
                    schedules = emptyList(),
                    enabled = true,
                )
            return ruleset.copy(rules = ruleset.rules + rule)
        }
    }
}
