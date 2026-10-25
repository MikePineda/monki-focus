// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.notice

/**
 * Port: shows the persistent protection notice through [ProtectionNotice].
 * The app implements it (it holds the notification permission, channel,
 * icon and the dismissal receiver); the service calls [reconcile] when it
 * connects, on every tick and when it stops.
 */
interface ProtectionNotifier {
    fun reconcile(
        protectionActive: Boolean,
        content: NoticeContent,
    )

    /** The user swiped the notice away (`deleteIntent`). */
    fun dismissed()
}
