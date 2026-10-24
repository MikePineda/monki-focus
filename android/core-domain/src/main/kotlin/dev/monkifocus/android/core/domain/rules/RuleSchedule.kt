// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonContentPolymorphicSerializer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject

/** A rule's schedule: a window of its own or a reference to the rule set's work hours. */
@Serializable(with = RuleScheduleSerializer::class)
sealed interface RuleSchedule

/** `schedule.schema.json#/$defs/ruleSchedule`: an object with `ref` is a reference, anything else a window. */
internal object RuleScheduleSerializer : JsonContentPolymorphicSerializer<RuleSchedule>(RuleSchedule::class) {
    override fun selectDeserializer(element: JsonElement): DeserializationStrategy<RuleSchedule> =
        if ("ref" in element.jsonObject) ScheduleRef.serializer() else Schedule.serializer()
}
