// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.service.accessibility.exit.ExitFlowState
import dev.monkifocus.android.service.accessibility.ui.OverlayTestTags
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** The home screen never lets protection run unseen (plan 04 §2, rule 2). */
@RunWith(RobolectricTestRunner::class)
class HomeScreenTest {
    @get:Rule
    val compose = createComposeRule()

    private fun show(status: HomeStatus) {
        compose.setContent {
            MonkiTheme { ScaffoldHomeScreen(status = status, onRequestNotice = {}, onTurnOnProtection = {}, onExitAndUnlink = {}) }
        }
    }

    @Test
    fun protection_running_without_the_notice_shows_the_banner_status_and_request() {
        show(HomeStatus.of(serviceEnabled = true, armedByUser = true, exit = ExitFlowState.Armed, noticePermitted = false))

        compose.onNodeWithTag(OverlayTestTags.NOTICE_OFF).assertIsDisplayed()
        compose.onNodeWithText("Protection notice: off").assertIsDisplayed()
        compose.onNodeWithTag(HomeTestTags.REQUEST_NOTICE).assertIsDisplayed()
    }

    @Test
    fun with_the_notice_on_the_status_says_so_and_no_banner_shows() {
        show(HomeStatus.of(serviceEnabled = true, armedByUser = true, exit = ExitFlowState.Armed, noticePermitted = true))

        compose.onNodeWithText("Protection notice: on").assertIsDisplayed()
        compose.onNodeWithTag(OverlayTestTags.NOTICE_OFF).assertDoesNotExist()
    }

    @Test
    fun the_banner_follows_whether_protection_is_active() {
        val notArmed = HomeStatus.of(serviceEnabled = true, armedByUser = false, exit = ExitFlowState.Armed, noticePermitted = false)
        assertEquals("not armed: nothing runs, no banner", false, notArmed.noticeOffBanner)

        fun banner(
            enabled: Boolean,
            exit: ExitFlowState,
        ) = HomeStatus.of(serviceEnabled = enabled, armedByUser = true, exit = exit, noticePermitted = false).noticeOffBanner
        assertEquals(false, banner(enabled = false, exit = ExitFlowState.Armed))
        assertEquals(false, banner(enabled = true, exit = ExitFlowState.Ended(1)))
        assertEquals(true, banner(enabled = true, exit = ExitFlowState.Waiting(1, boot = 1)))
    }
}
