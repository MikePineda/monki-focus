// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.notice

import dev.monkifocus.android.service.accessibility.exit.ExitFlowState

/** What the notice says: whom it names and whether an exit is under way. */
data class NoticeContent(
    val guardianLinked: Boolean,
    val exitPending: Boolean,
) {
    companion object {
        /** The content for the current state; every caller (service, dismissal receiver) derives it here. */
        fun of(
            guardianLinked: Boolean,
            exit: ExitFlowState,
        ): NoticeContent = NoticeContent(guardianLinked = guardianLinked, exitPending = exit is ExitFlowState.Waiting)
    }
}
