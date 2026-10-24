// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/** `bedtime.schema.json`: the nightly window that blocks distracting targets. */
@Serializable
data class Bedtime(
    val enabled: Boolean,
    override val days: List<Weekday>,
    override val start: String,
    override val end: String,
    val warnMinutesBefore: Int,
) : DailyWindowSpec
