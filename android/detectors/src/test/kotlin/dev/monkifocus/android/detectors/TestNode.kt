// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * A hand-built [UiNode] for unit tests. It records every read of [text] and
 * [contentDescription] in [textReads], so a test can prove which nodes had
 * their text looked at.
 */
class TestNode(
    override val viewId: String? = null,
    private val textValue: String? = null,
    private val contentDescValue: String? = null,
    override val className: String? = "android.view.View",
    override val packageName: String? = null,
    override val bounds: Rect = Rect(0, 0, 1080, 2400),
    override val isVisibleToUser: Boolean = true,
    override val isSelected: Boolean = false,
    override val isFocused: Boolean = false,
    override val children: List<TestNode> = emptyList(),
    private val textReads: MutableList<String> = mutableListOf(),
) : UiNode {
    override val text: String?
        get() = textValue.also { textReads += "text:${viewId ?: "?"}" }

    override val contentDescription: String?
        get() = contentDescValue.also { textReads += "desc:${viewId ?: "?"}" }

    override fun findByViewId(fullId: String): List<UiNode> =
        (if (viewId == fullId) listOf(this) else emptyList<UiNode>()) + children.flatMap { it.findByViewId(fullId) }

    /** This subtree with [pkg] as the package of every node that names none (a real tree always names one). */
    fun inPackage(pkg: String): TestNode =
        TestNode(
            viewId,
            textValue,
            contentDescValue,
            className,
            packageName ?: pkg,
            bounds,
            isVisibleToUser,
            isSelected,
            isFocused,
            children.map { it.inPackage(pkg) },
            textReads,
        )
}

/** A full-size window of [packageName] around [children]; nodes without a package get [packageName]. */
fun window(
    packageName: String,
    vararg children: TestNode,
): Screen = Screen.of(TestNode(className = "android.widget.FrameLayout", children = children.toList()).inPackage(packageName), packageName)

/** A detector pack with the required fields filled in, for classifier unit tests. */
fun aPack(
    packId: String = "instagram",
    packages: List<String> = listOf("com.instagram.android"),
    version: String = "2026.10.25.1",
    urlBarViewIds: List<String> = emptyList(),
    vararg surfaces: SurfaceDetector,
): DetectorPack =
    DetectorPack(
        schemaVersion = 1,
        packId = packId,
        packVersion = version,
        minSchemaVersion = 1,
        packages = packages,
        testedAppVersions = emptyList(),
        unclassifiedCapMinutes = 0,
        keepVisible = emptyList(),
        urlBarViewIds = urlBarViewIds,
        surfaces = surfaces.toList(),
    )
