// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import dev.monkifocus.android.service.accessibility.exit.ExitFlowState
import dev.monkifocus.android.service.accessibility.notice.NoticeContent

/**
 * The protection notice was swiped away (its `deleteIntent`, our own
 * immutable PendingIntent; not exported): post it again at once while
 * protection is active.
 */
class NoticeDismissedReceiver : BroadcastReceiver() {
    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        val graph = (context.applicationContext as MonkiApplication).graph
        val notifier = graph.notifier
        notifier.dismissed()
        val exit = graph.protection.exitFlow.state
        notifier.reconcile(
            protectionActive = graph.accessibilityServiceEnabled() && exit !is ExitFlowState.Ended,
            content = NoticeContent(guardianLinked = false, exitPending = exit is ExitFlowState.Waiting),
        )
    }
}
