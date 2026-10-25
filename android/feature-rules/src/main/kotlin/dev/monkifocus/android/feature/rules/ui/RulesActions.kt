// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.ui

import dev.monkifocus.android.core.domain.rules.Ruleset

/**
 * What the rules screen can ask for. [onEdit] takes a pure edit of the
 * configured set; the host proposes it through the `RuleChangeService`
 * (tighten now, loosen later), never writing the set itself.
 */
class RulesActions(
    val onBack: () -> Unit,
    val onEdit: ((Ruleset) -> Ruleset) -> Unit,
    val onCancelPending: () -> Unit,
    val onExport: () -> Unit,
    val onImport: () -> Unit,
)
