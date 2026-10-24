// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Ruleset
import kotlinx.serialization.Serializable

/** What applies today and when `new` takes full effect (`rule-change-fixture.schema.json` `then`). */
@Serializable
data class EffectiveRuleSet(
    val effectiveToday: Ruleset,
    /** When `new` takes full effect (UTC); null when it already applies entirely. */
    val effectiveFrom: String?,
)
