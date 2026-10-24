// SPDX-License-Identifier: AGPL-3.0-or-later
@file:OptIn(ExperimentalSerializationApi::class)

package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator

/**
 * `target.schema.json`: what a rule, category assignment or unlock applies to
 * (SEMANTICS.md §3.1). Domains are normalised like hosts before matching.
 */
@Serializable
@JsonClassDiscriminator("kind")
sealed class Target

/** An app by Android package name or macOS bundle id. */
@Serializable
@SerialName("app")
data class AppTarget(
    @SerialName("package") val packageName: String,
) : Target()

/** A domain (and its subdomains), optionally narrowed by a path glob (§3.2). */
@Serializable
@SerialName("site")
data class SiteTarget(
    val domain: String,
    val path: String? = null,
) : Target()

/** A surface id from `data/surfaces.json`, on the web and in apps alike. */
@Serializable
@SerialName("surface")
data class SurfaceTarget(
    val surface: String,
) : Target()
