// SPDX-License-Identifier: AGPL-3.0-or-later
@file:OptIn(ExperimentalSerializationApi::class)

package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator

/**
 * `decision-context.schema.json#/$defs/observation`: what the user is about to
 * see, as raw URL text (normalised by the engine) or an app with the surface
 * its detector resolved.
 */
@Serializable
@JsonClassDiscriminator("kind")
sealed class Observation

/** Raw URL text as a tab or a mobile URL bar shows it. */
@Serializable
@SerialName("site")
data class SiteObservation(
    val urlText: String,
) : Observation()

/** A foreground app and the surface its detector recognised, or null. */
@Serializable
@SerialName("app")
data class AppObservation(
    @SerialName("package") val packageName: String,
    val surface: String?,
) : Observation()
