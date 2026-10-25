// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.ui

import dev.monkifocus.android.feature.onboarding.status.ActiveRulesSummary
import dev.monkifocus.android.feature.onboarding.status.ChecklistEntry
import dev.monkifocus.android.feature.onboarding.status.ProtectionState

/**
 * Everything the Status screen shows: the protection state, the permission
 * checklist, the rules in force (null while they load), whether they could
 * not be read ([rulesUnavailable]: the service fails closed, Status and
 * Exit and unlink still work) and whether the protection notice can be
 * posted.
 */
data class StatusUi(
    val protection: ProtectionState,
    val checklist: List<ChecklistEntry>,
    val rules: ActiveRulesSummary?,
    val noticePermitted: Boolean,
    val rulesUnavailable: Boolean = false,
)
