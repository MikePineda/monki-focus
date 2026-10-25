// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.packs

import dev.monkifocus.android.detectors.DetectorPack

/**
 * The packages the service watches (docs/threat-model.md, "otro navegador"):
 * the static `packageNames` of its config plus every browser found on the
 * device (the activities that resolve an `ACTION_VIEW` of an http URL), set
 * at connect with `setServiceInfo`. Browsers no pack can read are
 * [unsupported]: the pipeline gives them app friction and bedtime.
 */
data class WatchedPackages(
    val all: Set<String>,
    val unsupported: Set<String>,
) {
    companion object {
        fun of(
            configured: Collection<String>,
            browsersOnDevice: Collection<String>,
            ourPackage: String,
            packs: List<DetectorPack>,
        ): WatchedPackages {
            val browsers = browsersOnDevice.filter { it != ourPackage }.toSet()
            val readable = packs.flatMap { it.packages }.toSet()
            return WatchedPackages(all = configured.toSet() + browsers, unsupported = browsers - readable)
        }
    }
}
