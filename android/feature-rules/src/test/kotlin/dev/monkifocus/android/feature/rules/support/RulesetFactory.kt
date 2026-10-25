// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.support

import dev.monkifocus.android.core.domain.rules.Bedtime
import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.Schedule
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.core.domain.rules.Target
import dev.monkifocus.android.core.domain.rules.Weekday

/** Synthetic rules and rule sets, the Kotlin twins of the extension's `makeRule` / `makeRuleset`. */
object RulesetFactory {
    val EVERY_DAY: List<Weekday> = Weekday.entries.toList()
    val WORK_DAYS: List<Weekday> = listOf(Weekday.MON, Weekday.TUE, Weekday.WED, Weekday.THU, Weekday.FRI)

    fun aRule(
        id: String = "site-example",
        target: Target = SiteTarget("example.com"),
        mode: RuleMode = RuleMode.FRICTION,
        dailyBudgetMinutes: Int? = null,
        enabled: Boolean = true,
    ): Rule =
        Rule(id = id, target = target, mode = mode, schedules = emptyList(), dailyBudgetMinutes = dailyBudgetMinutes, enabled = enabled)

    /**
     * A rule set pinned to `Etc/GMT-2` (UTC+2 all year, so local midnight is
     * always 22:00Z): one budgeted friction rule on example.com, bedtime
     * 22:30–07:00 every day, work hours Mon–Fri 09:00–17:30.
     */
    fun aRuleset(
        rules: List<Rule> = listOf(aRule(dailyBudgetMinutes = 30)),
        timeZone: String = "Etc/GMT-2",
        revision: Int = 1,
    ): Ruleset =
        Ruleset(
            schemaVersion = 1,
            revision = revision,
            updatedAt = "2026-10-01T00:00:00Z",
            timeZone = timeZone,
            rules = rules,
            categories = emptyList(),
            bedtime = Bedtime(enabled = true, days = EVERY_DAY, start = "22:30", end = "07:00", warnMinutesBefore = 30),
            workHours = Schedule(WORK_DAYS, "09:00", "17:30"),
        )

    /** [ruleset] with the budget of its first rule set to [minutes]. */
    fun withBudget(
        ruleset: Ruleset,
        minutes: Int?,
    ): Ruleset = ruleset.copy(rules = listOf(ruleset.rules.first().copy(dailyBudgetMinutes = minutes)) + ruleset.rules.drop(1))

    /** [count] block rules on `<prefix><n>.example`, ids `<prefix>-000` …. */
    fun blocks(
        prefix: String,
        count: Int,
    ): List<Rule> =
        (0 until count).map { index ->
            aRule(id = "$prefix-${index.toString().padStart(3, '0')}", target = SiteTarget("$prefix$index.example"), mode = RuleMode.BLOCK)
        }
}
