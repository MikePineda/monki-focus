// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.packs

import dev.monkifocus.android.detectors.DetectorPack
import dev.monkifocus.android.detectors.DetectorPackLoader
import dev.monkifocus.android.detectors.PackLoadResult
import java.time.Instant

/**
 * The detector packs the service classifies with, loaded on every start
 * through [DetectorPackLoader] and never from a stored decode:
 *
 * - each pack bundled in the APK passes every check except the detached
 *   signature (it is part of the signed app);
 * - a downloaded pack (its bytes and signature kept under
 *   `noBackupFilesDir`) is re-verified each time against the bundled pack of
 *   the same id and the trusted time, and replaces it only when accepted;
 * - a bundled pack that fails its checks is a build error: it is left out
 *   rather than trusted, and the build's tests keep the bundled packs valid.
 */
class ActivePacks(
    private val loader: DetectorPackLoader,
) {
    /** A downloaded pack as stored: the exact bytes and their detached signature. */
    class Downloaded(
        val bytes: ByteArray,
        val signature: ByteArray,
    )

    fun load(
        bundled: Map<String, ByteArray>,
        downloaded: Map<String, Downloaded>,
        now: Instant,
    ): List<DetectorPack> =
        bundled.entries.sortedBy { it.key }.mapNotNull { (packId, bytes) ->
            val base = (loader.loadBundled(bytes) as? PackLoadResult.Accepted)?.pack ?: return@mapNotNull null
            val stored = downloaded[packId] ?: return@mapNotNull base
            when (val result = loader.loadDownloaded(stored.bytes, stored.signature, base, now)) {
                is PackLoadResult.Accepted -> loader.active(base, result.pack)
                is PackLoadResult.Rejected -> base
            }
        }
}
