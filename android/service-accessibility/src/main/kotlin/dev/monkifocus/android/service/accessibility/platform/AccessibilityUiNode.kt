// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.view.accessibility.AccessibilityNodeInfo
import dev.monkifocus.android.detectors.Rect
import dev.monkifocus.android.detectors.UiNode
import android.graphics.Rect as AndroidRect

/**
 * [UiNode] over an `AccessibilityNodeInfo`, read lazily: children, bounds
 * and text are fetched only when a detector asks, and the traversal bound
 * of `BoundedTraversal` (2,500 nodes, depth 40) limits how many are ever
 * visited. [findByViewId] uses the native id search.
 *
 * Privacy: [text] and [contentDescription] are handed to the detectors for
 * an in-memory comparison only; this adapter never stores, copies or logs
 * them. Node objects are not recycled: since API 33 recycling is a no-op and
 * below that the garbage collector reclaims them.
 */
internal class AccessibilityUiNode(
    private val info: AccessibilityNodeInfo,
) : UiNode {
    override val viewId: String? get() = info.viewIdResourceName

    override val text: String? get() = info.text?.toString()

    override val contentDescription: String? get() = info.contentDescription?.toString()

    override val className: String? get() = info.className?.toString()

    override val packageName: String? get() = info.packageName?.toString()

    override val bounds: Rect by lazy {
        val out = AndroidRect()
        info.getBoundsInScreen(out)
        Rect(out.left, out.top, out.right, out.bottom)
    }

    override val isVisibleToUser: Boolean get() = info.isVisibleToUser

    override val isSelected: Boolean get() = info.isSelected

    override val isFocused: Boolean get() = info.isFocused

    override val children: List<UiNode> by lazy {
        (0 until info.childCount).mapNotNull { index -> info.getChild(index)?.let(::AccessibilityUiNode) }
    }

    override fun findByViewId(fullId: String): List<UiNode> =
        info.findAccessibilityNodeInfosByViewId(fullId).orEmpty().map(::AccessibilityUiNode)
}
