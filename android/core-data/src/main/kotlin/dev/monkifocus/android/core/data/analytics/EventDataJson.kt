// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.analytics

import dev.monkifocus.android.core.domain.analytics.AfkStatus
import dev.monkifocus.android.core.domain.analytics.EventData
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.security.MessageDigest

/**
 * The stored JSON of an event payload, in the ActivityWatch shape of
 * `activity.schema.json`. Encoding is canonical (keys sorted, compact, absent
 * optional keys left out), so equal payloads have equal text and equal
 * [hashOf]: the natural key of `aw_event`.
 */
object EventDataJson {
    fun encode(data: EventData): String = JsonObject(fieldsOf(data).toSortedMap()).toString()

    fun decode(json: String): EventData {
        val fields = Json.parseToJsonElement(json).jsonObject
        return when {
            "app" in fields -> {
                EventData.Window(fields.text("app"), fields.optionalText("title"))
            }

            "status" in fields -> {
                EventData.Afk(AfkStatus.ofCode(fields.text("status")))
            }

            "domain" in fields -> {
                EventData.WebTab(
                    domain = fields.text("domain"),
                    path = fields.text("path"),
                    surface = fields.optionalText("surface"),
                    audible = fields.getValue("audible").jsonPrimitive.boolean,
                    incognito = fields.getValue("incognito").jsonPrimitive.boolean,
                    title = fields.optionalText("title"),
                )
            }

            else -> {
                throw IllegalArgumentException("Unknown event data")
            }
        }
    }

    /** Lower-case hex SHA-256 of the canonical JSON. */
    fun hashOf(canonicalJson: String): String =
        MessageDigest
            .getInstance("SHA-256")
            .digest(canonicalJson.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }

    private fun fieldsOf(data: EventData): Map<String, JsonElement> =
        when (data) {
            is EventData.Window -> {
                mapOf("app" to JsonPrimitive(data.app)) + titleOf(data.title)
            }

            is EventData.Afk -> {
                mapOf("status" to JsonPrimitive(data.status.code))
            }

            is EventData.WebTab -> {
                mapOf(
                    "domain" to JsonPrimitive(data.domain),
                    "path" to JsonPrimitive(data.path),
                    "surface" to (data.surface?.let(::JsonPrimitive) ?: JsonNull),
                    "audible" to JsonPrimitive(data.audible),
                    "incognito" to JsonPrimitive(data.incognito),
                ) + titleOf(data.title)
            }
        }

    private fun titleOf(title: String?): Map<String, JsonElement> = title?.let { mapOf("title" to JsonPrimitive(it)) }.orEmpty()

    private fun JsonObject.text(name: String): String = getValue(name).jsonPrimitive.content

    private fun JsonObject.optionalText(name: String): String? = (get(name) as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content
}
