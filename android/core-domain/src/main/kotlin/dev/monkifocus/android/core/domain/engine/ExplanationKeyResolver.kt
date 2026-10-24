// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Access
import dev.monkifocus.android.core.domain.rules.Content
import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.domain.rules.ReasonCode

/**
 * The i18n key of a decision (SEMANTICS.md §5.4), fixed by the primary
 * outcome. For `rule_match`: `decision.blocked_by_rule` when access is
 * `block`, else `decision.feed_hidden` when content is `hide-feed`, else
 * `decision.allowed_by_rule`; every other reason maps to `decision.<reason>`.
 * The domain never returns text.
 */
internal fun explanationKeyOf(
    access: Access,
    content: Content,
    reason: ReasonCode,
): ExplanationKey =
    when {
        reason != ReasonCode.RULE_MATCH -> ExplanationKey.ofReason(reason)
        access == Access.BLOCK -> ExplanationKey.BLOCKED_BY_RULE
        content == Content.HIDE_FEED -> ExplanationKey.FEED_HIDDEN
        else -> ExplanationKey.ALLOWED_BY_RULE
    }
