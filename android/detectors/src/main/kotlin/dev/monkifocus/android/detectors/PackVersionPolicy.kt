// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import java.time.Instant
import java.time.ZoneOffset

/**
 * Which pack versions this build accepts, compiled into the app:
 *
 * - [minimumVersions]: per pack id, the version bundled with this build. A
 *   downloaded pack must be strictly newer than the larger of this and the
 *   installed pack, so wiping the app's storage never re-opens an older one;
 * - [revoked]: `packId@packVersion` entries withdrawn after release (a pack
 *   that turned out to leave a surface open), never accepted again;
 * - a version dated more than [MAX_FUTURE_DAYS] days after the caller's
 *   trusted `now` (UTC) is refused, so a pack cannot pre-empt every future
 *   release by claiming year 9999.
 */
class PackVersionPolicy(
    private val minimumVersions: Map<String, String>,
    private val revoked: Set<String> = emptySet(),
) {
    /** The compiled floor of [packId], or null when the build knows no such pack. */
    fun minimumOf(packId: String): PackVersion? = minimumVersions[packId]?.let(PackVersion::parse)

    fun isRevoked(pack: DetectorPack): Boolean = "${pack.packId}@${pack.packVersion}" in revoked

    fun isFromTheFuture(
        version: PackVersion,
        now: Instant,
    ): Boolean = version.date.isAfter(now.atOffset(ZoneOffset.UTC).toLocalDate().plusDays(MAX_FUTURE_DAYS))

    companion object {
        const val MAX_FUTURE_DAYS = 2L

        /** Versions withdrawn after release. Empty: nothing has been revoked yet. */
        val REVOKED_PACK_VERSIONS: Set<String> = emptySet()

        /** The bundled versions of this build (a test keeps them equal to the bundled packs). */
        val COMPILED =
            PackVersionPolicy(
                minimumVersions =
                    mapOf(
                        "instagram" to "2026.10.25.2",
                        "youtube" to "2026.10.25.2",
                        "browsers" to "2026.10.25.2",
                        "settings" to "2026.10.25.2",
                    ),
                revoked = REVOKED_PACK_VERSIONS,
            )
    }
}
