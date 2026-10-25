// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.support

import dev.monkifocus.android.detectors.Rect
import dev.monkifocus.android.detectors.Screen
import dev.monkifocus.android.detectors.UiNode

/** A hand-built [UiNode]; every read of its text is counted in [textReads]. */
internal class FakeNode(
    override val viewId: String? = null,
    private val textValue: String? = null,
    override val className: String? = "android.view.View",
    override val packageName: String? = null,
    override val bounds: Rect = Rect(0, 0, 1080, 2400),
    override val isVisibleToUser: Boolean = true,
    override val isFocused: Boolean = false,
    override val children: List<FakeNode> = emptyList(),
    private val textReads: MutableList<String> = mutableListOf(),
) : UiNode {
    override val text: String?
        get() = textValue.also { textReads += viewId ?: "?" }

    override val contentDescription: String? = null
    override val isSelected: Boolean = false

    override fun findByViewId(fullId: String): List<UiNode> =
        (if (viewId == fullId) listOf(this) else emptyList<UiNode>()) + children.flatMap { it.findByViewId(fullId) }
}

/**
 * A browser window of [packageName] with its toolbar URL bar showing [url]
 * (no bar at all when null) over a WebView whose page text is [pageText].
 */
internal fun browserScreen(
    url: String?,
    packageName: String = CHROME,
    focused: Boolean = false,
    pageText: String = "page text",
    textReads: MutableList<String> = mutableListOf(),
): Screen {
    val bar =
        url?.let {
            FakeNode(
                viewId = "$packageName:id/url_bar",
                textValue = it,
                className = "android.widget.EditText",
                packageName = packageName,
                bounds = Rect(130, 100, 900, 200),
                isFocused = focused,
                textReads = textReads,
            )
        }
    val toolbar =
        FakeNode(
            viewId = "$packageName:id/toolbar",
            packageName = packageName,
            bounds = Rect(0, 77, 1080, 220),
            children = listOfNotNull(bar),
        )
    val page =
        FakeNode(
            className = "android.webkit.WebView",
            packageName = packageName,
            bounds = Rect(0, 220, 1080, 2400),
            children =
                listOf(
                    FakeNode(textValue = pageText, packageName = packageName, bounds = Rect(40, 300, 1040, 400), textReads = textReads),
                ),
        )
    val root = FakeNode(className = "android.widget.FrameLayout", packageName = packageName, children = listOf(toolbar, page))
    return Screen.of(root, packageName)
}

/** An app window nothing in the packs recognises. */
internal fun blankScreen(packageName: String): Screen =
    Screen.of(FakeNode(className = "android.widget.FrameLayout", packageName = packageName), packageName)
