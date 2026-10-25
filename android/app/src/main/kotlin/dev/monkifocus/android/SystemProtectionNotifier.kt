// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import dev.monkifocus.android.service.accessibility.notice.NoticeCommand
import dev.monkifocus.android.service.accessibility.notice.NoticeContent
import dev.monkifocus.android.service.accessibility.notice.ProtectionNotice
import dev.monkifocus.android.service.accessibility.notice.ProtectionNotifier
import dev.monkifocus.android.core.ui.R as CoreUiR

/**
 * The persistent protection notice on the system shade (plan 04 §2, rule 2):
 * "monki-focus is active · your guardian sees: score, unlocks, bypasses",
 * ongoing, silent, with "Exit and unlink" as its action. [ProtectionNotice]
 * decides when to post, update or cancel; a dismissal comes back through
 * [NoticeDismissedReceiver] and the notice is posted again.
 *
 * Android 14+ lets users swipe away ongoing notifications of apps without a
 * foreground service. No foreground service is used: the dismissal is
 * answered at once and every service tick checks the shade again, so the
 * notice is back within a second. Main thread only.
 */
class SystemProtectionNotifier(
    context: Context,
) : ProtectionNotifier {
    private val appContext = context.applicationContext
    private val manager: NotificationManager = appContext.getSystemService(NotificationManager::class.java)
    private val notice = ProtectionNotice()

    override fun reconcile(
        protectionActive: Boolean,
        content: NoticeContent,
    ) {
        val showing = runCatching { manager.activeNotifications.any { it.id == NOTICE_ID } }.getOrDefault(false)
        val permitted = NotificationManagerCompat.from(appContext).areNotificationsEnabled()
        when (val command = notice.reconcile(protectionActive, showing, permitted, content)) {
            is NoticeCommand.Post -> post(command.content)
            NoticeCommand.Cancel -> manager.cancel(NOTICE_ID)
            NoticeCommand.None -> Unit
        }
    }

    override fun dismissed() {
        notice.dismissed()
    }

    private fun post(content: NoticeContent) {
        ensureChannel()
        val text =
            when {
                content.exitPending -> CoreUiR.string.notice_text_exit_pending
                content.guardianLinked -> CoreUiR.string.notice_text_guardian
                else -> CoreUiR.string.notice_text_no_guardian
            }
        val notification =
            NotificationCompat
                .Builder(appContext, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_protection_notice)
                .setContentTitle(appContext.getString(CoreUiR.string.notice_title))
                .setContentText(appContext.getString(text))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setShowWhen(false)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(openApp(REQUEST_OPEN, exit = false))
                .addAction(0, appContext.getString(CoreUiR.string.notice_action_exit), openApp(REQUEST_EXIT, exit = true))
                .setDeleteIntent(dismissal())
                .build()
        runCatching { manager.notify(NOTICE_ID, notification) }
    }

    private fun ensureChannel() {
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel =
            NotificationChannel(
                CHANNEL_ID,
                appContext.getString(CoreUiR.string.notice_channel_name),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = appContext.getString(CoreUiR.string.notice_channel_description)
                setShowBadge(false)
            }
        manager.createNotificationChannel(channel)
    }

    private fun openApp(
        requestCode: Int,
        exit: Boolean,
    ): PendingIntent {
        val intent =
            Intent(appContext, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(MainActivity.EXTRA_OPEN_EXIT, exit)
        return PendingIntent.getActivity(appContext, requestCode, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    private fun dismissal(): PendingIntent =
        PendingIntent.getBroadcast(
            appContext,
            REQUEST_DISMISS,
            Intent(appContext, NoticeDismissedReceiver::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

    private companion object {
        const val CHANNEL_ID = "protection_status"
        const val NOTICE_ID = 1
        const val REQUEST_OPEN = 1
        const val REQUEST_EXIT = 2
        const val REQUEST_DISMISS = 3
    }
}
