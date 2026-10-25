// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.action

import dev.monkifocus.android.core.domain.engine.ENGINE_ERROR_DECISION
import dev.monkifocus.android.core.domain.rules.Access
import dev.monkifocus.android.core.domain.rules.AppObservation
import dev.monkifocus.android.core.domain.rules.Content
import dev.monkifocus.android.core.domain.rules.Decision
import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.domain.rules.ReasonCode
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.service.accessibility.decision.Evaluation
import dev.monkifocus.android.service.accessibility.support.INSTAGRAM
import dev.monkifocus.android.service.accessibility.support.aRule
import dev.monkifocus.android.service.accessibility.support.aRuleset
import dev.monkifocus.android.service.accessibility.support.app
import dev.monkifocus.android.service.accessibility.support.surface
import org.junit.Assert.assertEquals
import org.junit.Test

class ActionSelectorTest {
    private val ruleset =
        aRuleset(
            aRule("reels", surface("instagram.reels"), RuleMode.BLOCK),
            aRule("instagram", app(INSTAGRAM), RuleMode.BLOCK),
        )
    private val cover = CoverRegion(200, 2200)
    private val observation = AppObservation(INSTAGRAM, "instagram.reels")

    private fun decision(
        access: Access,
        content: Content = Content.SHOW,
        ruleId: String? = null,
        reason: ReasonCode = ReasonCode.RULE_MATCH,
    ) = Decision(access, content, ruleId, reason, gate = null, explanationKey = ExplanationKey.BLOCKED_BY_RULE, validUntil = null)

    private fun select(
        decision: Decision,
        phase: EscalationPhase = EscalationPhase.IDLE,
    ) = ActionSelector.select(Evaluation(decision, ruleset, observation), cover) { phase }

    @Test
    fun allow_and_show_clears_the_overlay() {
        assertEquals(ActionPlan.Clear, select(decision(Access.ALLOW)))
    }

    @Test
    fun allow_with_a_hidden_feed_covers_between_the_bars() {
        assertEquals(ActionPlan.Cover(cover), select(decision(Access.ALLOW, Content.HIDE_FEED)))
    }

    @Test
    fun a_gate_shows_the_gate() {
        assertEquals(ActionPlan.Gate, select(decision(Access.GATE, ruleId = "reels", reason = ReasonCode.INTENTION_REQUIRED)))
    }

    @Test
    fun a_surface_block_goes_back_with_a_notice() {
        assertEquals(ActionPlan.BackWithNotice, select(decision(Access.BLOCK, ruleId = "reels")))
    }

    @Test
    fun a_surface_block_waiting_for_an_emergency_override_shows_the_wait() {
        assertEquals(ActionPlan.Gate, select(decision(Access.BLOCK, ruleId = "reels"), EscalationPhase.OVERRIDE_WAITING))
    }

    @Test
    fun an_app_block_shows_the_block_screen() {
        assertEquals(ActionPlan.Gate, select(decision(Access.BLOCK, ruleId = "instagram")))
    }

    @Test
    fun bedtime_budget_and_engine_errors_show_their_screens() {
        assertEquals(ActionPlan.Gate, select(decision(Access.BLOCK, reason = ReasonCode.SCHEDULE_BEDTIME)))
        assertEquals(ActionPlan.Gate, select(decision(Access.BLOCK, ruleId = "reels", reason = ReasonCode.BUDGET_EXHAUSTED)))
        assertEquals(ActionPlan.Gate, select(ENGINE_ERROR_DECISION))
    }
}
