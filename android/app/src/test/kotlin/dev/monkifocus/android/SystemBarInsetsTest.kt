// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import dev.monkifocus.android.core.ui.MonkiScreenRoot
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.feature.onboarding.flow.SetupSnapshot
import dev.monkifocus.android.feature.onboarding.status.ProtectionState
import dev.monkifocus.android.feature.onboarding.status.StatusChecklist
import dev.monkifocus.android.feature.onboarding.ui.StatusTestTags
import dev.monkifocus.android.feature.onboarding.ui.StatusUi
import dev.monkifocus.android.feature.stats.ui.StatsTestTags
import dev.monkifocus.android.service.accessibility.exit.ExitFlowState
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * Edge to edge is enforced from targetSdk 35: every screen MainActivity
 * hosts sits inside [MonkiScreenRoot], which keeps content out of the status
 * bar, the navigation bar and the display cutout. The test hands the root
 * explicit bar sizes, as a phone with a tall status bar would report them.
 */
@RunWith(RobolectricTestRunner::class)
class SystemBarInsetsTest {
    @get:Rule
    val compose = createComposeRule()

    private val statusBar = 32.dp
    private val navigationBar = 48.dp

    private fun showStatus() {
        val home = HomeStatus.of(serviceEnabled = true, armedByUser = true, exit = ExitFlowState.Armed, noticePermitted = true)
        val snapshot = SetupSnapshot.NOTHING.copy(notifications = true, accessibilityService = true)
        val status = StatusUi(ProtectionState.ACTIVE, StatusChecklist.of(snapshot, protectionWanted = true), null, true)
        compose.setContent {
            MonkiTheme {
                MonkiScreenRoot(
                    modifier = Modifier.testTag(ROOT),
                    insets = WindowInsets(top = statusBar, bottom = navigationBar),
                ) {
                    StatusHome(
                        home = home,
                        status = status,
                        onFix = {},
                        onRequestNotice = {},
                        onTurnOn = {},
                        onEditRules = {},
                        onExitAndUnlink = {},
                        onOpenStats = {},
                    )
                }
            }
        }
    }

    @Test
    fun status_screen_content_starts_below_the_status_bar() {
        showStatus()

        val top = compose.onNodeWithTag(StatsTestTags.ENTRY).getBoundsInRoot().top
        assertTrue("Statistics starts at $top, under a $statusBar status bar", top >= statusBar)
    }

    @Test
    fun the_last_item_scrolls_above_the_navigation_bar() {
        showStatus()

        val rootBottom = compose.onNodeWithTag(ROOT).getBoundsInRoot().bottom
        val exitBottom =
            compose
                .onNodeWithTag(StatusTestTags.EXIT)
                .performScrollTo()
                .getBoundsInRoot()
                .bottom
        assertTrue("Exit and unlink ends at $exitBottom, over the navigation bar", exitBottom <= rootBottom - navigationBar)
    }

    private companion object {
        const val ROOT = "screen_root"
    }
}
