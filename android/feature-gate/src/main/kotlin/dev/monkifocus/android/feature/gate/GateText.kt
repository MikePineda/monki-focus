// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.domain.rules.FrictionType
import dev.monkifocus.android.core.ui.R

/*
 * Domain keys to catalog strings. The engine returns keys, never text:
 * `decision.<name>` is the string `decision_<name>` (dots become
 * underscores); each pause type has its `why_<type>` line.
 */

/** The string of an engine explanation key. */
fun explanationTextRes(key: ExplanationKey): Int =
    when (key) {
        ExplanationKey.NO_RULE -> R.string.decision_no_rule
        ExplanationKey.ALLOWED_BY_RULE -> R.string.decision_allowed_by_rule
        ExplanationKey.BLOCKED_BY_RULE -> R.string.decision_blocked_by_rule
        ExplanationKey.FEED_HIDDEN -> R.string.decision_feed_hidden
        ExplanationKey.INTENTION_REQUIRED -> R.string.decision_intention_required
        ExplanationKey.INTENTION_ACTIVE -> R.string.decision_intention_active
        ExplanationKey.SCHEDULE_BEDTIME -> R.string.decision_schedule_bedtime
        ExplanationKey.BUDGET_EXHAUSTED -> R.string.decision_budget_exhausted
        ExplanationKey.UNLOCK_ACTIVE -> R.string.decision_unlock_active
        ExplanationKey.EMERGENCY_ACTIVE -> R.string.decision_emergency_active
        ExplanationKey.PERMALINK_NEVER_HIDDEN -> R.string.decision_permalink_never_hidden
        ExplanationKey.PATH_UNKNOWN_ALLOW -> R.string.decision_path_unknown_allow
        ExplanationKey.NOT_A_FEED -> R.string.decision_not_a_feed
        ExplanationKey.ENGINE_ERROR -> R.string.decision_engine_error
    }

/** The "why" line of a pause type. */
fun whyTextRes(type: FrictionType): Int =
    when (type) {
        FrictionType.COUNTDOWN -> R.string.why_countdown
        FrictionType.BREATH -> R.string.why_breath
        FrictionType.REFLECT -> R.string.why_reflect
        FrictionType.TYPE_INTENTION -> R.string.why_type_intention
    }
