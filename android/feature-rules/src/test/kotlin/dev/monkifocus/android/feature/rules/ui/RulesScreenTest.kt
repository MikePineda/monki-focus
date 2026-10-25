// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.ui

import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.SurfaceTarget
import dev.monkifocus.android.core.domain.validation.RejectionCode
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.feature.rules.change.PendingRuleChange
import dev.monkifocus.android.feature.rules.change.RuleChangeRejection
import dev.monkifocus.android.feature.rules.change.RuleChangeService
import dev.monkifocus.android.feature.rules.change.RulesMessage
import dev.monkifocus.android.feature.rules.change.RulesState
import dev.monkifocus.android.feature.rules.change.RulesetCheck
import dev.monkifocus.android.feature.rules.edit.RulesetEdits
import dev.monkifocus.android.feature.rules.support.InMemoryRulesetRepository
import dev.monkifocus.android.feature.rules.support.MutableClock
import dev.monkifocus.android.feature.rules.support.RulesData
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRule
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRuleset
import dev.monkifocus.android.feature.rules.support.RulesetFactory.withBudget
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class RulesScreenTest {
    @get:Rule
    val compose = createComposeRule()

    private val ruleset =
        aRuleset(rules = listOf(aRule(dailyBudgetMinutes = 30), aRule("reels", SurfaceTarget("instagram.reels"), RuleMode.HIDE_FEED)))

    private val edits = mutableListOf<Ruleset>()
    private val calls = mutableListOf<String>()

    private fun show(
        state: RulesState,
        message: RulesMessage? = null,
    ) {
        val actions =
            RulesActions(
                onBack = { calls += "back" },
                onEdit = { edits += it(state.configured) },
                onCancelPending = { calls += "cancel" },
                onExport = { calls += "export" },
                onImport = { calls += "import" },
            )
        compose.setContent { MonkiTheme { RulesScreen(state, message, actions) } }
    }

    @Test
    fun every_rule_shows_its_target_mode_schedule_and_budget() {
        show(RulesState(ruleset, null))

        compose.onNodeWithText("example.com").assertExists()
        compose.onNodeWithText("Instagram Reels").assertExists()
        compose.onNodeWithText("Always · 30 min a day").assertExists()
    }

    @Test
    fun switching_a_rule_off_or_changing_its_mode_is_an_edit_of_that_rule() {
        show(RulesState(ruleset, null))

        compose.onNodeWithTag(RulesTestTags.ruleEnabled("reels")).performScrollTo().performClick()

        assertEquals(RulesetEdits.setEnabled(ruleset, "reels", false), edits.single())
    }

    @Test
    fun a_pending_loosening_shows_what_waits_and_can_be_cancelled() {
        show(RulesState(ruleset, PendingRuleChange(withBudget(ruleset, 60), "2026-10-27T22:00:00Z")))

        compose.onNodeWithText("example.com: changed").assertExists()
        compose.onNodeWithText("Always · 60 min a day · Waits to apply").performScrollTo().assertExists()
        compose.onNodeWithTag(RulesTestTags.CANCEL_PENDING).performScrollTo().performClick()

        assertEquals(listOf("cancel"), calls)
    }

    @Test
    fun a_community_name_is_checked_before_it_is_allowed() {
        show(RulesState(ruleset, null))

        compose.onNodeWithTag(RulesTestTags.SUBREDDIT_FIELD).performScrollTo().performTextInput("not a name")
        compose.onNodeWithText("That is not a community name.").assertExists()
        compose.onNodeWithTag(RulesTestTags.SUBREDDIT_ADD).assertIsNotEnabled()
        compose.onNodeWithTag(RulesTestTags.SUBREDDIT_FIELD).performTextClearance()
        compose.onNodeWithTag(RulesTestTags.SUBREDDIT_FIELD).performTextInput("r/AskScience")
        compose.onNodeWithTag(RulesTestTags.SUBREDDIT_ADD).performScrollTo().performClick()

        assertEquals(RulesetEdits.allowSubreddit(ruleset, "AskScience"), edits.single())
    }

    @Test
    fun bedtime_times_are_checked_and_saved_together() {
        show(RulesState(ruleset, null))

        compose.onNodeWithTag(RulesTestTags.BEDTIME_START).performScrollTo().performTextClearance()
        compose.onNodeWithTag(RulesTestTags.BEDTIME_START).performTextInput("25:00")
        compose.onNodeWithTag(RulesTestTags.BEDTIME_SAVE).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithTag(RulesTestTags.BEDTIME_START).performTextClearance()
        compose.onNodeWithTag(RulesTestTags.BEDTIME_START).performTextInput("23:15")
        compose.onNodeWithTag(RulesTestTags.BEDTIME_SAVE).performScrollTo().performClick()

        assertEquals("23:15", edits.single().bedtime.start)
        assertEquals(ruleset.bedtime.end, edits.single().bedtime.end)
    }

    @Test
    fun a_refused_change_says_why() {
        show(RulesState(ruleset, null), RulesMessage.Rejected(RuleChangeRejection.ZONE_CHANGE_PENDING))

        compose.onNodeWithText("A time-zone change already waits", substring = true).assertExists()
    }

    @Test
    fun an_invalid_import_names_the_field() {
        show(RulesState(ruleset, null), RulesMessage.ImportInvalid(RejectionCode.SCHEMA, "/rules/0/mode"))

        compose.onNodeWithText("Nothing was imported. This rule set is not valid. (at /rules/0/mode)").assertExists()
    }

    @Test
    fun export_and_import_are_offered() {
        show(RulesState(ruleset, null))

        compose.onNodeWithTag(RulesTestTags.EXPORT).performScrollTo().performClick()
        compose.onNodeWithTag(RulesTestTags.IMPORT).performScrollTo().performClick()

        assertEquals(listOf("export", "import"), calls)
    }

    @Test
    fun the_route_saves_through_the_rule_change_service() {
        val repository = InMemoryRulesetRepository(ruleset)
        val service = RuleChangeService(repository, RulesData.catalog, RulesetCheck.of(RulesData.validator), { ruleset }, MutableClock(NOW))
        compose.setContent { MonkiTheme { RulesRoute(service, { RulesData.validator }, onBack = {}) } }

        // The rules load off the main thread.
        compose.waitUntil(TIMEOUT_MS) { compose.onAllNodesWithTag(RulesTestTags.BEDTIME_ENABLED).fetchSemanticsNodes().isNotEmpty() }

        // Turning bedtime off is a loosening: it waits for the next local midnight.
        compose.onNodeWithTag(RulesTestTags.BEDTIME_ENABLED).performScrollTo().performClick()
        compose.waitUntil(TIMEOUT_MS) { compose.onAllNodesWithTag(RulesTestTags.PENDING).fetchSemanticsNodes().isNotEmpty() }

        val active = runBlocking { repository.active(NOW) }
        assertEquals("what applies now keeps bedtime on", true, active?.ruleset?.bedtime?.enabled)
        assertEquals(false, runBlocking { repository.pending(NOW) }?.ruleset?.bedtime?.enabled)
    }

    private companion object {
        const val NOW = "2026-10-27T10:00:00Z"
        const val TIMEOUT_MS = 5_000L
    }
}
