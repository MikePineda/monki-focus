// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import kotlinx.serialization.Serializable

/**
 * `detector-pack.schema.json#/$defs/nodePredicate`: matches one node. Every
 * field present must hold; text fields are literal, case-sensitive
 * comparisons, never patterns.
 */
@Serializable
data class NodePredicate(
    val viewId: String? = null,
    val contentDesc: String? = null,
    val contentDescPrefix: String? = null,
    val text: String? = null,
    val className: String? = null,
    val onScreen: Boolean? = null,
    val selected: Boolean? = null,
    val minHeightRatio: Double? = null,
) {
    /** True when the predicate reads node text or a content description (the label tier). */
    val readsLabel: Boolean get() = contentDesc != null || contentDescPrefix != null || text != null
}
