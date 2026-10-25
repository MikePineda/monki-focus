// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import dev.monkifocus.android.service.accessibility.exit.ExitFlowState
import dev.monkifocus.android.service.accessibility.notice.NoticeVisibility

/**
 * What the home screen says about protection: whether the notice can be
 * posted (the Status line and the request button) and whether protection
 * runs without it, so the "notice is off" banner shows (plan 04 §2, rule 2).
 */
data class HomeStatus(
    val noticePermitted: Boolean,
    val noticeOffBanner: Boolean,
) {
    companion object {
        fun of(
            serviceEnabled: Boolean,
            armedByUser: Boolean,
            exit: ExitFlowState,
            noticePermitted: Boolean,
        ): HomeStatus {
            val active = serviceEnabled && armedByUser && exit !is ExitFlowState.Ended
            return HomeStatus(noticePermitted, NoticeVisibility.of(active, noticePermitted) == NoticeVisibility.BANNER)
        }
    }
}
