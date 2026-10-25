// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

/**
 * Whether the service may act (plan 04 §2: protection never runs unseen,
 * and only with the user's consent given in our own app).
 *
 * - [NOT_ARMED]: the service was turned on (for instance straight from
 *   system Settings) but the user has not finished "Turn on protection" in
 *   the app. Nothing is enforced, bedtime included; a non-blocking card
 *   invites the user to finish setting up.
 * - [AWAITING_NOTICE_CARD]: armed, but notifications are not allowed and
 *   the card that explains the protection status has not been shown in this
 *   session yet. Nothing is enforced until it has been.
 * - [ACTIVE]: armed and seen: through the notice, or through that card and
 *   then the banner on every screen.
 */
enum class Readiness {
    NOT_ARMED,
    AWAITING_NOTICE_CARD,
    ACTIVE,
    ;

    companion object {
        fun of(
            armedByUser: Boolean,
            noticePermitted: Boolean,
            noticeCardShown: Boolean,
        ): Readiness =
            when {
                !armedByUser -> NOT_ARMED
                !noticePermitted && !noticeCardShown -> AWAITING_NOTICE_CARD
                else -> ACTIVE
            }
    }
}
