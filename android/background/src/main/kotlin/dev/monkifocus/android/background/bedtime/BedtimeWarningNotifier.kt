// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.bedtime

/** Posts the bedtime warning (the app owns the channel, the icon and the copy). */
fun interface BedtimeWarningNotifier {
    /** Bedtime starts in about [minutesLeft] minutes. */
    fun warn(minutesLeft: Int)
}
