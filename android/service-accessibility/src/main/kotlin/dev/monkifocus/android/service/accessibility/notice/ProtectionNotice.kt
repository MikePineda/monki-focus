// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.notice

/**
 * The persistent "monki-focus is active" notification (plan 04 §2,
 * conciliation rule 2): while protection is active it is always on screen,
 * posted again whenever it is missing (dismissed, cleared, never posted),
 * updated when what it says changes, and cancelled when protection ends.
 * It never posts twice for nothing. Without the notification permission it
 * cannot post; the Status screen shows that instead.
 *
 * Android 14+ lets the user swipe away even ongoing notifications of apps
 * without a foreground service; this machine is why that never hides the
 * protection for long: the dismissal (`deleteIntent`) and every service tick
 * reconcile it again. No foreground service is needed.
 */
class ProtectionNotice {
    private var posted: NoticeContent? = null

    /** What to do now. [showing] is whether the system still lists our notification. */
    fun reconcile(
        protectionActive: Boolean,
        showing: Boolean,
        permitted: Boolean,
        content: NoticeContent,
    ): NoticeCommand {
        if (!protectionActive) {
            val wasPosted = posted != null
            posted = null
            return if (showing || wasPosted) NoticeCommand.Cancel else NoticeCommand.None
        }
        if (!permitted) {
            posted = null
            return NoticeCommand.None
        }
        if (showing && posted == content) return NoticeCommand.None
        posted = content
        return NoticeCommand.Post(content)
    }

    /** The user dismissed it: the next [reconcile] posts it again. */
    fun dismissed() {
        posted = null
    }
}
