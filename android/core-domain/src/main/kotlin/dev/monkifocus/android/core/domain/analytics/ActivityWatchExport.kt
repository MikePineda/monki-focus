// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.engine.utcInstantOf
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull

/**
 * ActivityWatch export, in the shape aw-server writes for `GET /api/0/export`
 * and reads back on `POST /api/0/import`: `{"buckets": {"<id>": {id, created,
 * type, client, hostname, data, events: [{timestamp, duration, data}]}}}`.
 * Durations are seconds, timestamps RFC 3339 UTC. Event data follows the
 * standard bucket types: `currentwindow` `{app, title}`, `afkstatus`
 * `{status}` and `web.tab.current` `{url, title, audible, incognito}`; web
 * events also keep `domain`, `path` and `surface`, and their `url` is
 * rebuilt from them (never a query or fragment, which are not stored).
 * This is the user's own data leaving through the user's own action.
 * Serialisable with kotlinx.serialization; bucket order is kept.
 */
@Serializable
data class ActivityWatchExport(
    val buckets: Map<String, Bucket>,
) {
    @Serializable
    data class Bucket(
        val id: String,
        val created: String,
        /** A [BucketType] wire code. */
        val type: String,
        val client: String,
        val hostname: String,
        /** Always `{}` on export. */
        val data: JsonObject,
        val events: List<Event>,
    )

    @Serializable
    data class Event(
        val timestamp: String,
        /** Seconds; aw-server writes fractions, an export writes whole seconds. */
        @Serializable(with = SecondsSerializer::class) val duration: Double,
        /** Flat strings, booleans and nulls. */
        val data: JsonObject,
    )
}

/** Writes whole seconds as integers (`60`, not `60.0`) and reads any JSON number. */
private object SecondsSerializer : KSerializer<Double> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("monkifocus.Seconds", PrimitiveKind.DOUBLE)

    override fun serialize(
        encoder: Encoder,
        value: Double,
    ) {
        val whole = value.toLong()
        if (whole.toDouble() == value) encoder.encodeLong(whole) else encoder.encodeDouble(value)
    }

    override fun deserialize(decoder: Decoder): Double = decoder.decodeDouble()
}

/**
 * Bucket ids follow the aw-watcher convention `<watcher>_<hostname>`. The web
 * bucket names the browser (`monki-web-chrome_<host>`) because the
 * ActivityWatch dashboard pairs web buckets with browser windows by finding
 * the browser name in the bucket id.
 */
fun activityWatchBucketId(
    type: BucketType,
    hostname: String,
    browser: String = "chrome",
): String =
    when (type) {
        BucketType.CURRENT_WINDOW -> "monki-window_$hostname"
        BucketType.AFK_STATUS -> "monki-afk_$hostname"
        BucketType.WEB_TAB_CURRENT -> "monki-web-${browser}_$hostname"
    }

private fun exportedData(
    type: BucketType,
    data: EventData,
): JsonObject =
    when {
        type == BucketType.CURRENT_WINDOW && data is EventData.Window -> {
            JsonObject(linkedMapOf("app" to JsonPrimitive(data.app), "title" to JsonPrimitive(data.title ?: "")))
        }

        type == BucketType.AFK_STATUS && data is EventData.Afk -> {
            JsonObject(linkedMapOf("status" to JsonPrimitive(data.status.code)))
        }

        type == BucketType.WEB_TAB_CURRENT && data is EventData.WebTab -> {
            JsonObject(
                linkedMapOf(
                    "url" to JsonPrimitive("https://${data.domain}${data.path}"),
                    "title" to JsonPrimitive(data.title ?: ""),
                    "audible" to JsonPrimitive(data.audible),
                    "incognito" to JsonPrimitive(data.incognito),
                    "domain" to JsonPrimitive(data.domain),
                    "path" to JsonPrimitive(data.path),
                    "surface" to JsonPrimitive(data.surface),
                ),
            )
        }

        else -> {
            throw IllegalArgumentException("An event does not fit a ${type.code} bucket")
        }
    }

fun toActivityWatchExport(buckets: List<ActivityWatchBucket>): ActivityWatchExport {
    val exported = LinkedHashMap<String, ActivityWatchExport.Bucket>()
    for ((bucket, events) in buckets) {
        require(bucket.id !in exported) { "Duplicate bucket id" }
        exported[bucket.id] =
            ActivityWatchExport.Bucket(
                id = bucket.id,
                created = utcInstantOf(epochSecondsOf(bucket.created)),
                type = bucket.type.code,
                client = bucket.client,
                hostname = bucket.hostname,
                data = JsonObject(emptyMap()),
                events =
                    events
                        .sortedBy { epochSecondsOf(it.timestamp) }
                        .map { event ->
                            ActivityWatchExport.Event(
                                timestamp = utcInstantOf(epochSecondsOf(event.timestamp)),
                                duration = event.duration.toDouble(),
                                data = exportedData(bucket.type, event.data),
                            )
                        },
            )
    }
    return ActivityWatchExport(exported)
}

private fun text(
    data: JsonObject,
    key: String,
): String {
    val value = data[key]
    require(value is JsonPrimitive && value.isString) { "Event data $key must be a string" }
    return value.content
}

private fun flag(
    data: JsonObject,
    key: String,
): Boolean {
    val value = data[key]
    val flag = (value as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull
    require(flag != null) { "Event data $key must be a boolean" }
    return flag
}

private fun importedData(
    type: BucketType,
    data: JsonObject,
): EventData {
    val title = (data["title"] as? JsonPrimitive)?.takeIf { it.isString && it.content.isNotEmpty() }?.content
    return when (type) {
        BucketType.CURRENT_WINDOW -> {
            EventData.Window(app = text(data, "app"), title = title)
        }

        BucketType.AFK_STATUS -> {
            val status = text(data, "status")
            EventData.Afk(AfkStatus.entries.firstOrNull { it.code == status } ?: throw IllegalArgumentException("Unknown AFK status"))
        }

        BucketType.WEB_TAB_CURRENT -> {
            EventData.WebTab(
                domain = text(data, "domain"),
                path = text(data, "path"),
                surface = if (data["surface"] is JsonNull) null else text(data, "surface"),
                audible = flag(data, "audible"),
                incognito = flag(data, "incognito"),
                title = title,
            )
        }
    }
}

/** aw-server writes microseconds (`…:00.123456+00:00`); instants here are whole seconds. */
private val FRACTIONAL_SECONDS = Regex("""\.\d+(?=Z$|[+-]\d{2}:\d{2}$)""")

private fun wholeSecondsOf(timestamp: String): String = utcInstantOf(epochSecondsOf(FRACTIONAL_SECONDS.replaceFirst(timestamp, "")))

/**
 * Reads back an export written by [toActivityWatchExport] (after a JSON
 * round trip) or by aw-server: timestamps in UTC `Z` (fractions dropped),
 * durations rounded to whole seconds (half up).
 */
fun fromActivityWatchExport(document: ActivityWatchExport): List<ActivityWatchBucket> =
    document.buckets.values.map { bucket ->
        val type = BucketType.ofCode(bucket.type)
        ActivityWatchBucket(
            bucket =
                ActivityBucket(
                    id = bucket.id,
                    type = type,
                    client = bucket.client,
                    hostname = bucket.hostname,
                    created = wholeSecondsOf(bucket.created),
                ),
            events =
                bucket.events.map { event ->
                    ActivityEvent(
                        timestamp = wholeSecondsOf(event.timestamp),
                        duration = eventSecondsOf(Math.round(event.duration)),
                        data = importedData(type, event.data),
                    )
                },
        )
    }
