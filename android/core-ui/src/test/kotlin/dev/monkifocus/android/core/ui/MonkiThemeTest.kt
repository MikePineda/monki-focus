// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createComposeRule
import dev.monkifocus.android.core.ui.theme.MonkiDarkColors
import dev.monkifocus.android.core.ui.theme.MonkiLightColors
import dev.monkifocus.android.core.ui.theme.MonkiThemeMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
class MonkiThemeTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    @Config(qualifiers = "notnight")
    fun the_system_light_setting_gives_the_light_tokens() {
        var surface = Color.Unspecified
        compose.setContent { MonkiTheme { surface = MonkiTheme.colors.surface0 } }

        compose.runOnIdle { assertEquals(MonkiLightColors.surface0, surface) }
    }

    @Test
    @Config(qualifiers = "night")
    fun the_system_dark_setting_gives_the_dark_tokens() {
        var surface = Color.Unspecified
        compose.setContent { MonkiTheme { surface = MonkiTheme.colors.surface0 } }

        compose.runOnIdle { assertEquals(MonkiDarkColors.surface0, surface) }
    }

    @Test
    @Config(qualifiers = "notnight")
    fun the_override_wins_over_the_system_setting() {
        var surface = Color.Unspecified
        var background = Color.Unspecified
        compose.setContent {
            MonkiTheme(themeMode = MonkiThemeMode.DARK) {
                surface = MonkiTheme.colors.surface0
                background = MaterialTheme.colorScheme.background
            }
        }

        compose.runOnIdle {
            assertEquals(MonkiDarkColors.surface0, surface)
            assertEquals(MonkiDarkColors.surface0, background)
        }
    }

    @Test
    fun motion_is_on_by_default() {
        var reduced = true
        compose.setContent { MonkiTheme { reduced = MonkiTheme.reducedMotion } }

        compose.runOnIdle { assertFalse(reduced) }
    }
}
