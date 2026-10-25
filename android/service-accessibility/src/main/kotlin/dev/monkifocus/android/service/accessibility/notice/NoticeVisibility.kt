// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.notice

/**
 * How active protection makes itself seen (plan 04 §2, rule 2): through the
 * persistent notice, or, when the notification permission is missing, a
 * "protection active · notice is off" banner on the app's home screen and on
 * every gate and bounce screen. Active protection is never without one of
 * the two.
 */
enum class NoticeVisibility {
    /** The persistent notice is on the shade. */
    NOTICE,

    /** No notice possible: the in-app banner shows instead. */
    BANNER,

    /** Protection is not active: nothing to show. */
    NONE,
    ;

    companion object {
        fun of(
            protectionActive: Boolean,
            notificationsPermitted: Boolean,
        ): NoticeVisibility =
            when {
                !protectionActive -> NONE
                notificationsPermitted -> NOTICE
                else -> BANNER
            }
    }
}
