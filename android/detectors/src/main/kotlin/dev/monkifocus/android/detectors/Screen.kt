// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * The foreground window as the detectors see it: its UI tree, the package
 * that owns it, the window class (when the event reports one) and the
 * screen size used by `onScreen` and `minHeightRatio`.
 */
data class Screen(
    val root: UiNode,
    val packageName: String,
    val windowClass: String?,
    val width: Int,
    val height: Int,
) {
    init {
        require(width > 0 && height > 0) { "screen size must be positive" }
    }

    /** True when [rect] has a visible area inside the screen. */
    fun shows(rect: Rect): Boolean =
        rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < width && rect.bottom > 0 && rect.top < height

    companion object {
        /** A screen the size of its root node (uiautomator dumps put the window at the root). */
        fun of(
            root: UiNode,
            packageName: String,
            windowClass: String? = null,
        ): Screen = Screen(root, packageName, windowClass, root.bounds.right, root.bounds.bottom)
    }
}
