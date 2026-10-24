// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.runtime.Immutable

/**
 * What the gate screens report back; the overlay adapter turns each one into
 * an escalation event (SEMANTICS.md §7.3) and an action (home, back, allow).
 *
 * - [onClose]: Close, and Leave on the timeout card (`close` / `leave`). Always available.
 * - [onContinue]: commit with the typed intention (may be empty below L2) and 5, 10 or 15 minutes.
 * - [onEmergency]: `emergency_request`.
 * - [onCancelEmergency]: cancel the emergency wait (`close` in `override_waiting`).
 * - [onExtend]: "5 more min" after a timeout (`extend`, counts as broken).
 */
@Immutable
class GateActions(
    val onClose: () -> Unit,
    val onContinue: (intention: String, minutes: Int) -> Unit = { _, _ -> },
    val onEmergency: () -> Unit = {},
    val onCancelEmergency: () -> Unit = {},
    val onExtend: () -> Unit = {},
)
