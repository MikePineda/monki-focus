// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.fixtures

import dev.monkifocus.android.core.domain.analytics.BlockOptions
import dev.monkifocus.android.core.domain.analytics.activeTime
import dev.monkifocus.android.core.domain.analytics.capAcrossDevices
import dev.monkifocus.android.core.domain.analytics.categorise
import dev.monkifocus.android.core.domain.analytics.dailyTotals
import dev.monkifocus.android.core.domain.analytics.dedupeBrowserTime
import dev.monkifocus.android.core.domain.analytics.mergeHeartbeats
import dev.monkifocus.android.core.domain.analytics.probeTab
import dev.monkifocus.android.core.domain.analytics.pulse
import dev.monkifocus.android.core.domain.analytics.toBlocks
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/**
 * SEMANTICS.md §10: every `activity` fixture, one test per fixture id. The
 * output is encoded as JSON and compared with `then` (arrays in order, §1).
 */
@RunWith(Parameterized::class)
class ActivityFixturesTest(
    @Suppress("unused") private val id: String,
    private val fixture: Fixture,
) {
    @Test
    fun computes_the_activity_as_specified() {
        assertEquals(fixture.json.getValue("then"), actualOf(fixture.json))
    }

    private fun actualOf(case: JsonObject): JsonElement {
        val given = case.getValue("given").jsonObject
        val catalog = RulesPackage.catalog
        return when (val operation = case.getValue("operation").jsonPrimitive.content) {
            "heartbeat-merge" -> {
                val merged =
                    mergeHeartbeats(
                        ActivityJson.events(given, "events"),
                        ActivityJson.events(given, "heartbeats"),
                        given.getValue("pulsetime").jsonPrimitive.long,
                    )
                JsonObject(mapOf("events" to ActivityJson.array(merged, ActivityJson::json)))
            }

            "probe" -> {
                JsonObject(mapOf("heartbeat" to ActivityJson.json(probeTab(ActivityJson.tabProbe(given), catalog))))
            }

            "active-time" -> {
                val active = activeTime(ActivityJson.events(given, "events"), ActivityJson.events(given, "afk"))
                JsonObject(mapOf("events" to ActivityJson.array(active, ActivityJson::json)))
            }

            "categorise" -> {
                val match =
                    categorise(
                        ActivityJson.activity(given.getValue("activity").jsonObject),
                        ActivityJson.assignments(given),
                        catalog,
                        given.getValue("includeDefaults").jsonPrimitive.boolean,
                    )
                ActivityJson.json(match)
            }

            "pulse" -> {
                JsonObject(mapOf("pulse" to JsonPrimitive(pulse(ActivityJson.pulseEntries(given)))))
            }

            "blocks" -> {
                val options =
                    BlockOptions(
                        deviceId = given.getValue("deviceId").jsonPrimitive.content,
                        syncActivityKey = given.getValue("syncActivityKey").jsonPrimitive.boolean,
                    )
                val blocks = toBlocks(ActivityJson.attributedEvents(given), options)
                JsonObject(mapOf("blocks" to ActivityJson.array(blocks, ActivityJson::json)))
            }

            "daily-totals" -> {
                val days = dailyTotals(ActivityJson.levelledIntervals(given), given.getValue("timeZone").jsonPrimitive.content)
                JsonObject(mapOf("days" to ActivityJson.array(days, ActivityJson::json)))
            }

            "browser-dedupe" -> {
                val segments = dedupeBrowserTime(ActivityJson.browserDedupe(given))
                JsonObject(mapOf("segments" to ActivityJson.array(segments, ActivityJson::json)))
            }

            "cross-device-cap" -> {
                val capped = capAcrossDevices(ActivityJson.blocks(given, "blocks"))
                JsonObject(mapOf("blocks" to ActivityJson.array(capped, ActivityJson::json)))
            }

            else -> {
                throw IllegalArgumentException("Unknown activity operation: $operation")
            }
        }
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun fixtures(): List<Array<Any>> = FixtureLoader.parameters("activity")
    }
}
