// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.TypeConverter
import dev.monkifocus.android.core.domain.analytics.ActivitySource
import dev.monkifocus.android.core.domain.analytics.BucketType
import dev.monkifocus.android.core.domain.ports.IntentionOutcome
import dev.monkifocus.android.core.domain.ports.RulesetSource
import dev.monkifocus.android.core.domain.ports.UnlockStatus
import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.FrictionType
import dev.monkifocus.android.core.domain.rules.RulesJson
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive

/**
 * Enums are stored by their schema or wire code, never by the Kotlin constant
 * name, so renaming a constant can never change what is on disk. Unknown
 * codes throw: a row this version cannot read is a bug, not a default.
 */
class MonkiTypeConverters {
    @TypeConverter
    fun rulesetSourceToCode(value: RulesetSource): String = value.code

    @TypeConverter
    fun rulesetSourceOf(code: String): RulesetSource = RulesetSource.ofCode(code)

    @TypeConverter
    fun phaseToCode(value: EscalationPhase): String =
        RulesJson.encodeToJsonElement(EscalationPhase.serializer(), value).jsonPrimitive.content

    @TypeConverter
    fun phaseOf(code: String): EscalationPhase = RulesJson.decodeFromJsonElement(EscalationPhase.serializer(), JsonPrimitive(code))

    @TypeConverter
    fun frictionTypeToCode(value: FrictionType?): String? =
        value?.let { RulesJson.encodeToJsonElement(FrictionType.serializer(), it).jsonPrimitive.content }

    @TypeConverter
    fun frictionTypeOf(code: String?): FrictionType? =
        code?.let { RulesJson.decodeFromJsonElement(FrictionType.serializer(), JsonPrimitive(it)) }

    @TypeConverter
    fun outcomeToCode(value: IntentionOutcome?): String? = value?.code

    @TypeConverter
    fun outcomeOf(code: String?): IntentionOutcome? = code?.let(IntentionOutcome::ofCode)

    @TypeConverter
    fun unlockStatusToCode(value: UnlockStatus): String = value.code

    @TypeConverter
    fun unlockStatusOf(code: String): UnlockStatus = UnlockStatus.ofCode(code)

    @TypeConverter
    fun bucketTypeToCode(value: BucketType): String = value.code

    @TypeConverter
    fun bucketTypeOf(code: String): BucketType = BucketType.ofCode(code)

    @TypeConverter
    fun sourceToCode(value: ActivitySource): String = value.code

    @TypeConverter
    fun sourceOf(code: String): ActivitySource = ActivitySource.ofCode(code)

    @TypeConverter
    fun detailsToJson(value: Map<String, String>): String = RulesJson.encodeToString(DETAILS, value.toSortedMap())

    @TypeConverter
    fun detailsOf(json: String): Map<String, String> = RulesJson.decodeFromString(DETAILS, json)

    private companion object {
        val DETAILS = MapSerializer(String.serializer(), String.serializer())
    }
}
