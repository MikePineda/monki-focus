// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.fixtures

import dev.monkifocus.android.core.domain.engine.bedtimePhase
import dev.monkifocus.android.core.domain.engine.isScheduleActive
import dev.monkifocus.android.core.domain.rules.Bedtime
import dev.monkifocus.android.core.domain.rules.RuleSchedule
import dev.monkifocus.android.core.domain.rules.RulesJson
import dev.monkifocus.android.core.domain.rules.Schedule
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/** SEMANTICS.md §6: every `schedule` fixture (`isScheduleActive` or `bedtimePhase`). */
@RunWith(Parameterized::class)
class ScheduleFixturesTest(
    @Suppress("unused") private val id: String,
    private val fixture: Fixture,
) {
    @Serializable
    private data class ScheduleGiven(
        val schedules: List<RuleSchedule>,
        val workHours: Schedule,
        val now: String,
        val timeZone: String,
    )

    @Serializable
    private data class BedtimeGiven(
        val bedtime: Bedtime,
        val now: String,
        val timeZone: String,
    )

    @Test
    fun evaluates_as_specified() {
        val given = fixture.json.getValue("given").jsonObject
        val actual =
            if ("bedtime" in given) {
                val (bedtime, now, timeZone) = RulesJson.decodeFromJsonElement(BedtimeGiven.serializer(), given)
                JsonObject(mapOf("phase" to JsonPrimitive(bedtimePhase(bedtime, now, timeZone).code)))
            } else {
                val (schedules, workHours, now, timeZone) = RulesJson.decodeFromJsonElement(ScheduleGiven.serializer(), given)
                JsonObject(mapOf("active" to JsonPrimitive(isScheduleActive(schedules, workHours, now, timeZone))))
            }

        assertEquals(fixture.json.getValue("then"), actual)
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun fixtures(): List<Array<Any>> = FixtureLoader.parameters("schedule")
    }
}
