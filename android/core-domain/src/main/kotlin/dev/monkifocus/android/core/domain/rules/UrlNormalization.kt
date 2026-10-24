// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonContentPolymorphicSerializer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject

/** The result of `normalizeUrl` (SEMANTICS.md §2): a normalised URL or a rejection. */
@Serializable(with = UrlNormalizationSerializer::class)
sealed interface UrlNormalization

/** `url-normalize-fixture.schema.json#/$defs/normalizedUrl`. */
@Serializable
data class NormalizedUrl(
    val host: String,
    val path: String,
    val pathKnown: Boolean,
    val surface: String?,
) : UrlNormalization

/** `url-normalize-fixture.schema.json#/$defs/rejectedUrl`. */
@Serializable
data class RejectedUrl(
    val rejected: UrlRejection,
) : UrlNormalization

@Serializable
enum class UrlRejection {
    @SerialName("not_http")
    NOT_HTTP,

    @SerialName("invalid_host")
    INVALID_HOST,
}

internal object UrlNormalizationSerializer : JsonContentPolymorphicSerializer<UrlNormalization>(UrlNormalization::class) {
    override fun selectDeserializer(element: JsonElement): DeserializationStrategy<UrlNormalization> =
        if ("rejected" in element.jsonObject) RejectedUrl.serializer() else NormalizedUrl.serializer()
}
