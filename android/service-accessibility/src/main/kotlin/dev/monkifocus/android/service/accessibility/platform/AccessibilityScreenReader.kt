// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.accessibilityservice.AccessibilityService
import dev.monkifocus.android.detectors.Screen

/**
 * Reads the active window for the pipeline: the whole tree on demand
 * ([read]) or only the package name of the window in front ([foregroundPackage],
 * which the periodic tick uses to notice the user left a watched app).
 */
internal class AccessibilityScreenReader(
    private val service: AccessibilityService,
) {
    fun read(): Screen? {
        val root = service.rootInActiveWindow ?: return null
        val packageName = root.packageName?.toString() ?: return null
        val node = AccessibilityUiNode(root)
        val metrics = service.resources.displayMetrics
        val width = maxOf(metrics.widthPixels, node.bounds.right)
        val height = maxOf(metrics.heightPixels, node.bounds.bottom)
        if (width <= 0 || height <= 0) return null
        return Screen(node, packageName, windowClass = null, width = width, height = height)
    }

    fun foregroundPackage(): String? = service.rootInActiveWindow?.packageName?.toString()
}
