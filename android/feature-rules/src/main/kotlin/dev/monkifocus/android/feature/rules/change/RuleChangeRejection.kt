// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.change

import dev.monkifocus.android.core.domain.validation.RejectionCode

/**
 * Why a proposed rule set was refused, as a stable code (the UI maps it to
 * copy). Validation codes come from [RejectionCode]; the others:
 *
 * - [STALE_REVISION]: the screen edited an older set; reload;
 * - [TOO_MANY_RULES] / [INVALID_RULESET]: what would apply today (old
 *   waiting parts plus new tightening ones) does not validate;
 * - [ZONE_CHANGE_PENDING]: a time-zone change already waits and the
 *   proposal names a third zone (a set carries at most one waiting zone).
 */
enum class RuleChangeRejection(
    val code: String,
) {
    SCHEMA("schema"),
    DUPLICATE_KEY("duplicate_key"),
    INVALID_DOMAIN("invalid_domain"),
    INVALID_TIME_ZONE("invalid_time_zone"),
    TOO_LARGE("too_large"),
    INVALID_JSON("invalid_json"),
    STALE_REVISION("stale_revision"),
    TOO_MANY_RULES("too_many_rules"),
    INVALID_RULESET("invalid_ruleset"),
    ZONE_CHANGE_PENDING("zone_change_pending"),
    ;

    companion object {
        fun of(code: RejectionCode): RuleChangeRejection = entries.first { it.code == code.code }
    }
}
