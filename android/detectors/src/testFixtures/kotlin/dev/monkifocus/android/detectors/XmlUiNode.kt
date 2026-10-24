// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import org.w3c.dom.Element

/** A [UiNode] read from one `<node>` of a uiautomator dump (see [XmlUiDump]). */
class XmlUiNode private constructor(
    override val viewId: String?,
    override val text: String?,
    override val contentDescription: String?,
    override val className: String?,
    override val packageName: String?,
    override val bounds: Rect,
    override val isVisibleToUser: Boolean,
    override val isSelected: Boolean,
    override val isFocused: Boolean,
    override val children: List<XmlUiNode>,
) : UiNode {
    override fun findByViewId(fullId: String): List<UiNode> =
        (if (viewId == fullId) listOf(this) else emptyList<UiNode>()) + children.flatMap { it.findByViewId(fullId) }

    companion object {
        private val BOUNDS = Regex("""^\[(-?\d+),(-?\d+)]\[(-?\d+),(-?\d+)]$""")

        internal fun from(node: Element): XmlUiNode =
            XmlUiNode(
                viewId = node.optional("resource-id"),
                text = node.optional("text"),
                contentDescription = node.optional("content-desc"),
                className = node.optional("class"),
                packageName = node.optional("package"),
                bounds = parseBounds(node.getAttribute("bounds")),
                // Older uiautomator releases omit visible-to-user; a dumped node is on screen.
                isVisibleToUser = node.flag("visible-to-user", default = true),
                isSelected = node.flag("selected", default = false),
                isFocused = node.flag("focused", default = false),
                children = node.childElements("node").map(::from),
            )

        private fun parseBounds(raw: String): Rect {
            val (left, top, right, bottom) =
                requireNotNull(BOUNDS.matchEntire(raw)) { "bad bounds '$raw'" }.destructured
            return Rect(left.toInt(), top.toInt(), right.toInt(), bottom.toInt())
        }

        // uiautomator writes "" for an absent value.
        private fun Element.optional(name: String): String? = getAttribute(name).ifEmpty { null }

        private fun Element.flag(
            name: String,
            default: Boolean,
        ): Boolean = if (hasAttribute(name)) getAttribute(name) == "true" else default
    }
}
