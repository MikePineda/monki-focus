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
 * sends the user's actions back and reports whether it is really on screen
 * ([activityVisible], between `onStart` and `onStop`). When the activity
 * stops it [reset]s the content, so the next time the watched app comes back
 * the service launches it again instead of trusting a gate nobody sees.
 *
 * [noticeOff] is true while protection runs without its notice (no
 * notification permission): every gate and bounce screen shows the banner.
 */
class GateRelay {
    private val current = MutableStateFlow<OverlayContent?>(null)
    private val noticeOffState = MutableStateFlow(false)

    val content: StateFlow<OverlayContent?> = current.asStateFlow()

    val noticeOff: StateFlow<Boolean> = noticeOffState.asStateFlow()

    var activityVisible: Boolean = false
        private set

    /** Set by the running service; null while it is not connected. */
    var onAction: ((UserAction) -> Unit)? = null

    fun post(next: OverlayContent?) {
        current.value = next
    }

    fun setNoticeOff(off: Boolean) {
        noticeOffState.value = off
    }

    fun activityStarted() {
        activityVisible = true
    }

    /** The activity left the screen: nothing is shown any more, the next show launches it anew. */
    fun reset() {
        activityVisible = false
        current.value = null
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
