// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

import dev.monkifocus.android.core.domain.rules.Ruleset

/**
 * One revision of the rule-set document as stored: the document, the UTC
 * instant it applies from, where it came from and when it was written.
 */
data class StoredRuleset(
    val ruleset: Ruleset,
    val effectiveFrom: String,
    val source: RulesetSource,
    val createdAt: String,
)
