// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.packs

import dev.monkifocus.android.detectors.DetectorPackLoader
import dev.monkifocus.android.detectors.PackLoadResult
import java.time.Instant

/**
 * [StoredPackCheck] through [DetectorPackLoader.loadDownloaded], the same
 * checks the accessibility service applies on every start: each stored pack
 * against the bundled pack of its id and the trusted time. Nothing is
 * changed: a rejected pack simply never replaces the bundled one. The update
 * worker becomes a real download once a server and a pinned signing key exist
 * (phase 3).
 */
class LoaderStoredPackCheck(
    private val loader: DetectorPackLoader,
    private val bundled: () -> Map<String, ByteArray>,
    private val stored: StoredPackFiles,
) : StoredPackCheck {
    override fun run(now: Instant): PackRecheckResult {
        val bundledPacks = bundled()
        var accepted = 0
        var rejected = 0
        for ((packId, pack) in stored.read(bundledPacks.keys)) {
            val base = (bundledPacks[packId]?.let(loader::loadBundled) as? PackLoadResult.Accepted)?.pack
            val result = base?.let { loader.loadDownloaded(pack.bytes, pack.signature, it, now) }
            if (result is PackLoadResult.Accepted) accepted++ else rejected++
        }
        return PackRecheckResult(accepted, rejected)
    }
}
