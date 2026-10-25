// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import dev.monkifocus.android.background.bedtime.BedtimeWarningNotifier
import dev.monkifocus.android.core.ui.R as CoreUiR

/**
 * The bedtime warning on the system shade: a normal, dismissible
 * notification on its own channel (the user can silence it in Settings),
 * opening the app. Nothing is posted without the notification permission.
 */
class SystemBedtimeWarningNotifier(
    context: Context,
) : BedtimeWarningNotifier {
    private val appContext = context.applicationContext
    private val manager: NotificationManager = appContext.getSystemService(NotificationManager::class.java)

    override fun warn(minutesLeft: Int) {
        if (!NotificationManagerCompat.from(appContext).areNotificationsEnabled()) return
        ensureChannel()
        val open =
            PendingIntent.getActivity(
                appContext,
                REQUEST_OPEN,
                Intent(appContext, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
        val notification =
            NotificationCompat
                .Builder(appContext, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_protection_notice)
                .setContentTitle(appContext.getString(CoreUiR.string.bedtime_warning_title))
                .setContentText(appContext.getString(CoreUiR.string.bedtime_warning_text, minutesLeft))
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .setContentIntent(open)
                .build()
        runCatching { manager.notify(NOTIFICATION_ID, notification) }
    }

    private fun ensureChannel() {
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel =
            NotificationChannel(
                CHANNEL_ID,
                appContext.getString(CoreUiR.string.bedtime_warning_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply { description = appContext.getString(CoreUiR.string.bedtime_warning_channel_description) }
        manager.createNotificationChannel(channel)
    }

    private companion object {
        const val CHANNEL_ID = "bedtime_warning"

        /** The protection notice uses 1. */
        const val NOTIFICATION_ID = 2
        const val REQUEST_OPEN = 10
    }
}
