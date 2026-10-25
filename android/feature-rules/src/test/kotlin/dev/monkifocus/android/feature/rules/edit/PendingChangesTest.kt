// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.edit

import dev.monkifocus.android.core.domain.rules.CategoryAssignment
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.ScheduleRef
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.feature.rules.change.PendingRuleChange
import dev.monkifocus.android.feature.rules.change.RulesState
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRule
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRuleset
import dev.monkifocus.android.feature.rules.support.RulesetFactory.withBudget
import org.junit.Assert.assertEquals
import org.junit.Test

class PendingChangesTest {
    @Test
    fun bookkeeping_is_not_a_change() {
        val effective = aRuleset()

        assertEquals(
            emptyList<PendingChange>(),
            PendingChanges.between(effective, effective.copy(revision = 9, updatedAt = "2026-10-27T10:00:00Z")),
        )
    }

    @Test
    fun every_waiting_part_is_named() {
        val effective =
            aRuleset(rules = listOf(aRule("kept"), aRule("changed"), aRule("removed"))).copy(
                categories =
                    listOf(
                        CategoryAssignment(SiteTarget("a.example"), 0, "social"),
                        CategoryAssignment(SiteTarget("b.example"), 25, "x"),
                    ),
            )
        val configured =
            effective.copy(
                rules = listOf(aRule("kept"), aRule("changed", mode = RuleMode.ALLOW), aRule("added")),
                bedtime = effective.bedtime.copy(enabled = false),
                workHours = effective.workHours.copy(start = "10:00"),
                categories = effective.categories.reversed(),
                timeZone = "Etc/GMT-5",
            )

        assertEquals(
            listOf(
                PendingChange.RuleChanged("changed", SiteTarget("example.com")),
                PendingChange.RuleAdded("added", SiteTarget("example.com")),
                PendingChange.RuleRemoved("removed", SiteTarget("example.com")),
                PendingChange.BedtimeChanged,
                PendingChange.WorkHoursChanged,
                PendingChange.TimeZoneChanged,
            ),
            PendingChanges.between(effective, configured),
        )
    }

    @Test
    fun a_waiting_second_zone_is_a_time_zone_change() {
        val effective = aRuleset().copy(pendingTimeZone = "Etc/GMT-5")

        assertEquals(listOf(PendingChange.TimeZoneChanged), PendingChanges.between(effective, aRuleset()))
    }

    @Test
    fun the_list_marks_the_rules_that_still_wait_and_leaves_communities_out() {
        val effective = RulesetEdits.allowSubreddit(aRuleset(rules = listOf(aRule(dailyBudgetMinutes = 30), aRule("work"))), "news")
        val workHoursRule = effective.rules.first { it.id == "work" }.copy(schedules = listOf(ScheduleRef.WORK_HOURS))
        val budgeted = withBudget(effective, 60)
        val configured = budgeted.copy(rules = budgeted.rules.map { if (it.id == "work") workHoursRule else it })

        val rows = RuleSummary.rowsOf(RulesState(effective, PendingRuleChange(configured, "2026-10-27T22:00:00Z")))

        assertEquals(listOf("site-example", "work"), rows.map { it.id })
        assertEquals(listOf(true, true), rows.map { it.waiting })
        assertEquals(60, rows[0].dailyBudgetMinutes)
        assertEquals(ScheduleSummary.Always, rows[0].schedule)
        assertEquals(ScheduleSummary.WorkHours, rows[1].schedule)
        assertEquals(listOf(false, false), RuleSummary.rowsOf(RulesState(effective, null)).map { it.waiting })
    }
}
