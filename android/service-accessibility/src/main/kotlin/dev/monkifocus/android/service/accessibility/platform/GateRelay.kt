// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import dev.monkifocus.android.service.accessibility.action.OverlayContent
import dev.monkifocus.android.service.accessibility.pipeline.UserAction
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Connects `GateActivity` with the running service (same process, main
 * thread): the service posts the gate it wants in the activity, the activity
 * sends the user's actions back. Null content means the activity has nothing
 * to show and finishes.
 */
class GateRelay {
    private val current = MutableStateFlow<OverlayContent?>(null)

    val content: StateFlow<OverlayContent?> = current.asStateFlow()

    /** Set by the running service; null while it is not connected. */
    var onAction: ((UserAction) -> Unit)? = null

    fun post(next: OverlayContent?) {
        current.value = next
    }

    fun act(action: UserAction) {
        val handler = onAction
        if (handler != null) {
            handler(action)
        } else {
            // No service to answer: never keep the user on a gate.
            current.value = null
        }
    }
}
