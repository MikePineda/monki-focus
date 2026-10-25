// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.notice

import org.junit.Assert.assertEquals
import org.junit.Test

class ProtectionNoticeTest {
    private val notice = ProtectionNotice()
    private val plain = NoticeContent(guardianLinked = false, exitPending = false)

    private fun reconcile(
        active: Boolean = true,
        showing: Boolean,
        permitted: Boolean = true,
        content: NoticeContent = plain,
    ) = notice.reconcile(active, showing, permitted, content)

    @Test
    fun active_protection_posts_the_notice() {
        assertEquals(NoticeCommand.Post(plain), reconcile(showing = false))
    }

    @Test
    fun the_notice_is_not_posted_again_while_it_shows() {
        reconcile(showing = false)

        assertEquals(NoticeCommand.None, reconcile(showing = true))
    }

    @Test
    fun persistent_notification_reposted_when_dismissed() {
        reconcile(showing = false)

        notice.dismissed()

        assertEquals(NoticeCommand.Post(plain), reconcile(showing = false))
    }

    @Test
    fun a_notice_missing_from_the_shade_is_posted_again_even_without_a_dismiss_callback() {
        reconcile(showing = false)

        assertEquals(NoticeCommand.Post(plain), reconcile(showing = false))
    }

    @Test
    fun the_notice_is_updated_when_what_it_says_changes() {
        reconcile(showing = false)
        val exiting = plain.copy(exitPending = true)

        assertEquals(NoticeCommand.Post(exiting), reconcile(showing = true, content = exiting))
    }

    @Test
    fun the_notice_is_cancelled_when_protection_ends() {
        reconcile(showing = false)

        assertEquals(NoticeCommand.Cancel, reconcile(active = false, showing = true))
        assertEquals(NoticeCommand.None, reconcile(active = false, showing = false))
    }

    @Test
    fun without_the_notification_permission_nothing_is_posted() {
        assertEquals(NoticeCommand.None, reconcile(showing = false, permitted = false))
        assertEquals(NoticeCommand.Post(plain), reconcile(showing = false, permitted = true))
    }
}
