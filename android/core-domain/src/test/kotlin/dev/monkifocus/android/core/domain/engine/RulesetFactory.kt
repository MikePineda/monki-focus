// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Bedtime
import dev.monkifocus.android.core.domain.rules.DecisionState
import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.Schedule
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.core.domain.rules.Target
import dev.monkifocus.android.core.domain.rules.Weekday

/** Builders for synthetic rule sets, rules and decision state (generic zones and domains only). */
object RulesetFactory {
    val EVERY_DAY = Weekday.entries.toList()
    val WORK_DAYS = listOf(Weekday.MON, Weekday.TUE, Weekday.WED, Weekday.THU, Weekday.FRI)

    fun aRule(
        id: String,
        mode: RuleMode = RuleMode.BLOCK,
        target: Target = SiteTarget("example.org"),
        dailyBudgetMinutes: Int? = null,
        enabled: Boolean = true,
    ): Rule = Rule(id, target, mode, emptyList(), dailyBudgetMinutes, enabled)

    fun aRuleset(
        rules: List<Rule> = emptyList(),
        timeZone: String = "UTC",
        pendingTimeZone: String? = null,
        bedtimeEnabled: Boolean = false,
    ): Ruleset =
        Ruleset(
            schemaVersion = 1,
            revision = 1,
            updatedAt = "2026-01-01T00:00:00Z",
            timeZone = timeZone,
            pendingTimeZone = pendingTimeZone,
            rules = rules,
            categories = emptyList(),
            bedtime = Bedtime(bedtimeEnabled, EVERY_DAY, "22:30", "07:00", 30),
            workHours = Schedule(WORK_DAYS, "09:00", "17:30"),
        )

    fun aState(): DecisionState = DecisionState(escalation = emptyList(), usage = null, unlocks = emptyList(), guardianLinked = false)
}
