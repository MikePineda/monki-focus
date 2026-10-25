// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.gate

import dev.monkifocus.android.core.domain.rules.EscalationState

/**
 * Port: persists an escalation state the engine produced. The service
 * implements it with the Room `EscalationStateRepository`, written in order
 * off the main thread; the in-memory snapshot is already updated.
 */
fun interface EscalationSink {
    fun persist(state: EscalationState)
}
