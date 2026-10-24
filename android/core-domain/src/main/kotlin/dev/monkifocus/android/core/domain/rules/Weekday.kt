// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** A day of the week, Monday first (`schedule.schema.json#/$defs/weekday`); `ordinal` is Monday = 0 … Sunday = 6. */
@Serializable
enum class Weekday {
    @SerialName("mon")
    MON,

    @SerialName("tue")
    TUE,

    @SerialName("wed")
    WED,

    @SerialName("thu")
    THU,

    @SerialName("fri")
    FRI,

    @SerialName("sat")
    SAT,

    @SerialName("sun")
    SUN,
}
