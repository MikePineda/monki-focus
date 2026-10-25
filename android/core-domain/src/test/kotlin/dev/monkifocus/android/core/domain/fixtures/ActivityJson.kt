// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.fixtures

import dev.monkifocus.android.core.domain.analytics.ActivityBlock
import dev.monkifocus.android.core.domain.analytics.ActivityEvent
import dev.monkifocus.android.core.domain.analytics.ActivitySource
import dev.monkifocus.android.core.domain.analytics.AfkStatus
import dev.monkifocus.android.core.domain.analytics.AttributedEvent
import dev.monkifocus.android.core.domain.analytics.AttributedSegment
import dev.monkifocus.android.core.domain.analytics.BrowserDedupeInput
import dev.monkifocus.android.core.domain.analytics.CategorisableActivity
import dev.monkifocus.android.core.domain.analytics.CategoryMatch
import dev.monkifocus.android.core.domain.analytics.DailyTotal
import dev.monkifocus.android.core.domain.analytics.EventData
import dev.monkifocus.android.core.domain.analytics.LevelledInterval
import dev.monkifocus.android.core.domain.analytics.PulseInput
import dev.monkifocus.android.core.domain.analytics.TabProbeInput
import dev.monkifocus.android.core.domain.rules.CategoryAssignment
import dev.monkifocus.android.core.domain.rules.RulesJson
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long

/**
 * The `activity.schema.json` shapes as JSON, both ways, for the `activity`
 * fixtures (already validated against the schema by [FixtureLoader]).
 * Outputs are encoded back to JSON and compared with `then` as JSON values,
 * so a missing or extra key fails like the TypeScript `toStrictEqual`.
 */
object ActivityJson {
    private fun JsonObject.text(key: String): String = getValue(key).jsonPrimitive.content

    private fun JsonObject.textOrNull(key: String): String? = (get(key) as? JsonPrimitive)?.takeUnless { it is JsonNull }?.content

    private fun JsonObject.list(key: String): List<JsonObject> = getValue(key).jsonArray.map { it.jsonObject }

    fun event(json: JsonObject): ActivityEvent {
        val data = json.getValue("data").jsonObject
        val eventData =
            when {
                "app" in data -> {
                    EventData.Window(app = data.text("app"), title = data.textOrNull("title"))
                }

                "status" in data -> {
                    EventData.Afk(AfkStatus.ofCode(data.text("status")))
                }

                else -> {
                    EventData.WebTab(
                        domain = data.text("domain"),
                        path = data.text("path"),
                        surface = data.textOrNull("surface"),
                        audible = data.getValue("audible").jsonPrimitive.boolean,
                        incognito = data.getValue("incognito").jsonPrimitive.boolean,
                        title = data.textOrNull("title"),
                    )
                }
            }
        return ActivityEvent(json.text("timestamp"), json.getValue("duration").jsonPrimitive.int, eventData)
    }

    fun events(
        json: JsonObject,
        key: String,
    ): List<ActivityEvent> = json.list(key).map(::event)

    fun attributedEvent(json: JsonObject): AttributedEvent =
        AttributedEvent(
            timestamp = json.text("timestamp"),
            duration = json.getValue("duration").jsonPrimitive.int,
            source = ActivitySource.ofCode(json.text("source")),
            activityKey = json.text("activityKey"),
            categoryPath = json.text("categoryPath"),
            level = json.getValue("level").jsonPrimitive.int,
            title = json.textOrNull("title"),
            url = json.textOrNull("url"),
        )

    fun attributedEvents(json: JsonObject): List<AttributedEvent> = json.list("events").map(::attributedEvent)

    fun block(json: JsonObject): ActivityBlock =
        ActivityBlock(
            deviceId = json.text("deviceId"),
            blockStart = json.text("blockStart"),
            activityKey = json.textOrNull("activityKey"),
            categoryPath = json.text("categoryPath"),
            level = json.getValue("level").jsonPrimitive.int,
            source = ActivitySource.ofCode(json.text("source")),
            seconds = json.getValue("seconds").jsonPrimitive.int,
        )

    fun blocks(
        json: JsonObject,
        key: String,
    ): List<ActivityBlock> = json.list(key).map(::block)

    fun activity(json: JsonObject): CategorisableActivity =
        CategorisableActivity(
            source = ActivitySource.ofCode(json.text("source")),
            activityKey = json.text("activityKey"),
            path = json.textOrNull("path"),
            surface = json.textOrNull("surface"),
        )

    fun assignments(json: JsonObject): List<CategoryAssignment> =
        RulesJson.decodeFromJsonElement(
            kotlinx.serialization.builtins.ListSerializer(CategoryAssignment.serializer()),
            json.getValue("assignments"),
        )

    fun pulseEntries(json: JsonObject): List<PulseInput> =
        json.list("entries").map { PulseInput(it.getValue("seconds").jsonPrimitive.long, it.getValue("level").jsonPrimitive.int) }

    fun levelledIntervals(json: JsonObject): List<LevelledInterval> =
        json.list("entries").map {
            LevelledInterval(it.text("timestamp"), it.getValue("duration").jsonPrimitive.int, it.getValue("level").jsonPrimitive.int)
        }

    fun tabProbe(json: JsonObject): TabProbeInput {
        val tab = json.getValue("tab") as? JsonObject
        val settings = json.getValue("settings").jsonObject
        return TabProbeInput(
            now = json.text("now"),
            windowFocused = json.getValue("windowFocused").jsonPrimitive.boolean,
            idleState = TabProbeInput.IdleState.ofCode(json.text("idleState")),
            tab =
                tab?.let {
                    TabProbeInput.Tab(
                        url = it.text("url"),
                        audible = it.getValue("audible").jsonPrimitive.boolean,
                        incognito = it.getValue("incognito").jsonPrimitive.boolean,
                        title = it.textOrNull("title"),
                    )
                },
            settings =
                TabProbeInput.Settings(
                    countAudibleWhileIdle = settings.getValue("countAudibleWhileIdle").jsonPrimitive.boolean,
                    storeTitles = settings.getValue("storeTitles").jsonPrimitive.boolean,
                ),
        )
    }

    fun browserDedupe(json: JsonObject): BrowserDedupeInput =
        BrowserDedupeInput(
            browserApps = json.getValue("browserApps").jsonArray.map { it.jsonPrimitive.content },
            windowEvents = events(json, "windowEvents"),
            webEvents = events(json, "webEvents"),
            extensionLastHeartbeatAt = json.textOrNull("extensionLastHeartbeatAt"),
            staleAfterSeconds = json.getValue("staleAfterSeconds").jsonPrimitive.long,
        )

    fun json(event: ActivityEvent?): JsonElement {
        if (event == null) return JsonNull
        val data =
            when (val data = event.data) {
                is EventData.Window -> {
                    mapOf("app" to JsonPrimitive(data.app)) + optionalTitle(data.title)
                }

                is EventData.Afk -> {
                    mapOf("status" to JsonPrimitive(data.status.code))
                }

                is EventData.WebTab -> {
                    mapOf(
                        "domain" to JsonPrimitive(data.domain),
                        "path" to JsonPrimitive(data.path),
                        "surface" to JsonPrimitive(data.surface),
                        "audible" to JsonPrimitive(data.audible),
                        "incognito" to JsonPrimitive(data.incognito),
                    ) + optionalTitle(data.title)
                }
            }
        return JsonObject(
            mapOf(
                "timestamp" to JsonPrimitive(event.timestamp),
                "duration" to JsonPrimitive(event.duration),
                "data" to JsonObject(data),
            ),
        )
    }

    private fun optionalTitle(title: String?): Map<String, JsonElement> =
        if (title ==
            null
        ) {
            emptyMap()
        } else {
            mapOf("title" to JsonPrimitive(title))
        }

    fun json(block: ActivityBlock): JsonElement =
        JsonObject(
            mapOf(
                "deviceId" to JsonPrimitive(block.deviceId),
                "blockStart" to JsonPrimitive(block.blockStart),
                "activityKey" to JsonPrimitive(block.activityKey),
                "categoryPath" to JsonPrimitive(block.categoryPath),
                "level" to JsonPrimitive(block.level),
                "source" to JsonPrimitive(block.source.code),
                "seconds" to JsonPrimitive(block.seconds),
            ),
        )

    fun json(match: CategoryMatch): JsonElement =
        JsonObject(mapOf("level" to JsonPrimitive(match.level), "categoryPath" to JsonPrimitive(match.categoryPath)))

    fun json(day: DailyTotal): JsonElement =
        JsonObject(
            mapOf(
                "date" to JsonPrimitive(day.date),
                "seconds" to JsonPrimitive(day.seconds),
                "secondsByLevel" to
                    JsonObject(day.secondsByLevel.entries.associate { (level, seconds) -> "$level" to JsonPrimitive(seconds) }),
                "pulse" to JsonPrimitive(day.pulse),
            ),
        )

    fun json(segment: AttributedSegment): JsonElement =
        JsonObject(
            mapOf(
                "start" to JsonPrimitive(segment.start),
                "end" to JsonPrimitive(segment.end),
                "source" to JsonPrimitive(segment.source.code),
                "activityKey" to JsonPrimitive(segment.activityKey),
            ),
        )

    fun <T> array(
        items: List<T>,
        encode: (T) -> JsonElement,
    ): JsonArray = JsonArray(items.map(encode))
}
