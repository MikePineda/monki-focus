// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * One node of an on-screen UI tree, independent of Android.
 *
 * On a device it wraps an `AccessibilityNodeInfo`; in JVM tests it is parsed
 * from a sanitised `uiautomator` dump. [text] and [contentDescription] may
 * hold personal content: they are never persisted or logged.
 */
interface UiNode {
    /** Full resource id, `package:id/name`. */
    val viewId: String?
    val text: String?
    val contentDescription: String?
    val className: String?
    val packageName: String?
    val bounds: Rect
    val isVisibleToUser: Boolean
    val isSelected: Boolean
    val isFocused: Boolean
    val children: List<UiNode>

    /** Every node in this subtree, this one included, whose [viewId] equals [fullId]. */
    fun findByViewId(fullId: String): List<UiNode>
}
