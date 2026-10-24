// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.AppTarget
import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.core.domain.rules.SurfaceTarget
import dev.monkifocus.android.core.domain.rules.Target

/*
 * Specificity (SEMANTICS.md §4). Among candidates on one axis the most
 * specific wins; the first difference decides: refinement, literal path
 * segments, domain labels, wildcards (fewer wins), stricter mode, rule id
 * (code-unit ascending). A glob without literal segments counts as no path.
 */

/** Steps 1–4 of §4 for a target (also used for category assignments, §9). */
internal data class TargetSpecificity(
    val refinement: Int,
    val literals: Int,
    val labels: Int,
    val wildcards: Int,
)

/** `block > friction > hide-feed > allow` (step 5). */
internal fun modeStrictness(mode: RuleMode): Int =
    when (mode) {
        RuleMode.ALLOW -> 0
        RuleMode.HIDE_FEED -> 1
        RuleMode.FRICTION -> 2
        RuleMode.BLOCK -> 3
    }

internal fun targetSpecificity(
    target: Target,
    catalog: RulesCatalog,
): TargetSpecificity =
    when (target) {
        is AppTarget -> {
            TargetSpecificity(0, 0, 0, 0)
        }

        is SurfaceTarget -> {
            TargetSpecificity(1, 0, 0, 0)
        }

        is SiteTarget -> {
            val labels = domainLabelCount(catalog.normaliseDomain(target.domain))
            val shape = globShape(target.path ?: "/")
            if (shape.literals == 0) {
                TargetSpecificity(0, 0, labels, 0)
            } else {
                TargetSpecificity(1, shape.literals, labels, shape.wildcards)
            }
        }
    }

/** Negative when `a` is more specific than `b` by steps 1–4, positive when less, 0 on a tie. */
internal fun compareTargetSpecificity(
    a: TargetSpecificity,
    b: TargetSpecificity,
): Int =
    (b.refinement - a.refinement).takeIf { it != 0 }
        ?: (b.literals - a.literals).takeIf { it != 0 }
        ?: (b.labels - a.labels).takeIf { it != 0 }
        ?: (a.wildcards - b.wildcards)

/**
 * Full §4 order: negative when rule `a` outranks rule `b`. Step 5 always uses
 * the rule's own mode, also where §5.5 promotes it to an effective `friction`
 * (`decision.domain_only_youtube_is_not_allowed_by_default`).
 */
internal fun compareRules(
    a: Rule,
    b: Rule,
    catalog: RulesCatalog,
): Int =
    compareTargetSpecificity(targetSpecificity(a.target, catalog), targetSpecificity(b.target, catalog)).takeIf { it != 0 }
        ?: (modeStrictness(b.mode) - modeStrictness(a.mode)).takeIf { it != 0 }
        ?: a.id.compareTo(b.id).coerceIn(-1, 1)

/** "R outranks Q". */
internal fun outranks(
    r: Rule,
    q: Rule,
    catalog: RulesCatalog,
): Boolean = compareRules(r, q, catalog) < 0

/** The most specific rule of a list (the first one on a full tie), or null for an empty one. */
internal fun mostSpecific(
    rules: List<Rule>,
    catalog: RulesCatalog,
): Rule? = rules.minWithOrNull { a, b -> compareRules(a, b, catalog) }
