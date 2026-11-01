// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.gate

import dev.monkifocus.android.core.domain.engine.BEDTIME_GROUP
import dev.monkifocus.android.core.domain.rules.Access
import dev.monkifocus.android.core.domain.rules.Content
import dev.monkifocus.android.core.domain.rules.Decision
import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.domain.rules.ReasonCode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class GateGroupTest {
    private fun decision(
        access: Access,
        reason: ReasonCode,
        ruleId: String? = null,
    ) = Decision(access, Content.SHOW, ruleId, reason, null, ExplanationKey.NO_RULE, "2026-10-31T00:00:00Z")

    @Test
    fun a_rule_decision_belongs_to_its_rule() {
        assertEquals("reddit", GateGroup.of(decision(Access.GATE, ReasonCode.INTENTION_REQUIRED, "reddit")))
    }

    @Test
    fun a_relaxed_bedtime_gate_and_its_intention_belong_to_the_bedtime_group() {
        assertEquals(BEDTIME_GROUP, GateGroup.of(decision(Access.GATE, ReasonCode.INTENTION_REQUIRED)))
        assertEquals(BEDTIME_GROUP, GateGroup.of(decision(Access.ALLOW, ReasonCode.INTENTION_ACTIVE)))
        assertEquals(BEDTIME_GROUP, GateGroup.of(decision(Access.BLOCK, ReasonCode.SCHEDULE_BEDTIME)))
    }

    @Test
    fun no_rule_names_no_group() {
        assertNull(GateGroup.of(decision(Access.ALLOW, ReasonCode.NO_RULE)))
    }
}
