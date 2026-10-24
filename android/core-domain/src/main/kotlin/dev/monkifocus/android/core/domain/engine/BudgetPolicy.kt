// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.DailyUsage
import dev.monkifocus.android.core.domain.rules.Rule

/*
 * Daily budgets (SEMANTICS.md §5.2.2): any candidate, on either axis, whose
 * `dailyBudgetMinutes` is spent blocks (the most specific one names the
 * decision). Usage only counts when it is dated today in a pinned zone (either
 * zone while a zone change waits), so a budget block lasts until local
 * midnight and a move to a zone behind never grants an extra day. Rule ids
 * are map keys, so `constructor` or `toString` are ordinary ids (§14).
 */

internal fun exhaustedBudgetRule(
    candidates: List<Rule>,
    usage: DailyUsage?,
    todayDates: List<String>,
    catalog: RulesCatalog,
): Rule? {
    if (usage == null || usage.localDate !in todayDates) return null
    val exhausted =
        candidates.filter { rule ->
            val budget = rule.dailyBudgetMinutes
            budget != null && (usage.secondsByRule[rule.id] ?: 0) >= budget * 60
        }
    return mostSpecific(exhausted, catalog)
}
