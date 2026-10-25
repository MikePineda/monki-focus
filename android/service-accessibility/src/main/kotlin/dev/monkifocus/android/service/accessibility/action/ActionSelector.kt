// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.action

import dev.monkifocus.android.core.domain.rules.Access
import dev.monkifocus.android.core.domain.rules.Content
import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.ReasonCode
import dev.monkifocus.android.core.domain.rules.SurfaceTarget
import dev.monkifocus.android.service.accessibility.decision.Evaluation

/**
 * Chooses the action for a decision (plan §2.3, §2.5):
 *
 * - `allow` + `show` → nothing of ours on screen;
 * - `allow` + `hide-feed` → cover the feed between the bars the pack keeps
 *   visible. In browsers this is a cover, not BACK: BACK would leave the
 *   browser from a home page opened fresh, while the cover keeps the URL bar
 *   usable so a permalink is one tap away, and permalinks never get a cover
 *   because the engine shows them (SEMANTICS.md §5.3);
 * - `gate` → the friction gate;
 * - `block` by a **surface** rule (Reels, Shorts, also on the web) → BACK
 *   toward the inbox or home, then a dismissible notice that still offers
 *   emergency access; while that group waits for an emergency override the
 *   wait screen shows instead;
 * - every other `block` (an app or site rule, a spent budget, bedtime, the
 *   fail-closed engine error) → the block screen, which never traps: Close
 *   is always enabled.
 */
object ActionSelector {
    fun select(
        evaluation: Evaluation,
        cover: CoverRegion,
        phaseOf: (String) -> EscalationPhase,
    ): ActionPlan {
        val decision = evaluation.decision
        return when (decision.access) {
            Access.ALLOW -> {
                if (decision.content == Content.HIDE_FEED) ActionPlan.Cover(cover) else ActionPlan.Clear
            }

            Access.GATE -> {
                ActionPlan.Gate
            }

            Access.BLOCK -> {
                val ruleId = decision.ruleId
                val backs =
                    ruleId != null &&
                        decision.reason == ReasonCode.RULE_MATCH &&
                        evaluation.ruleset
                            ?.rules
                            ?.firstOrNull { it.id == ruleId }
                            ?.target is SurfaceTarget &&
                        phaseOf(ruleId) != EscalationPhase.OVERRIDE_WAITING
                if (backs) ActionPlan.BackWithNotice else ActionPlan.Gate
            }
        }
    }
}
