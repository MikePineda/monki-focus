// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/** `ruleset.schema.json#/$defs/relaxedWeekends`: softer weekends chosen by the user (SEMANTICS.md §6.4). */
@Serializable
data class RelaxedWeekends(
    val enabled: Boolean,
)
