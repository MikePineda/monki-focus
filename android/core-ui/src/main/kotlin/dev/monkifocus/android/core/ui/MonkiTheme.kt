// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import dev.monkifocus.android.core.ui.theme.LocalMonkiColors
import dev.monkifocus.android.core.ui.theme.LocalMonkiTypography
import dev.monkifocus.android.core.ui.theme.LocalReducedMotion
import dev.monkifocus.android.core.ui.theme.MonkiColors
import dev.monkifocus.android.core.ui.theme.MonkiDarkColorScheme
import dev.monkifocus.android.core.ui.theme.MonkiDarkColors
import dev.monkifocus.android.core.ui.theme.MonkiLightColorScheme
import dev.monkifocus.android.core.ui.theme.MonkiLightColors
import dev.monkifocus.android.core.ui.theme.MonkiThemeMode
import dev.monkifocus.android.core.ui.theme.MonkiTypography
import dev.monkifocus.android.core.ui.theme.rememberSystemReducedMotion
import dev.monkifocus.android.core.ui.theme.toMaterialTypography

/**
 * App theme, light and dark, built only from the generated
 * `packages/design-tokens` files (`theme/Monki*.kt`, copied at build time).
 * The system setting decides unless [themeMode] overrides it. Components
 * read the semantic colours through [MonkiTheme.colors]; Material 3
 * components get the matching Material roles. The native face is the
 * system font (Roboto) until the maintainer decides otherwise.
 */
@Composable
fun MonkiTheme(
    themeMode: MonkiThemeMode = MonkiThemeMode.SYSTEM,
    content: @Composable () -> Unit,
) {
    val dark =
        when (themeMode) {
            MonkiThemeMode.SYSTEM -> isSystemInDarkTheme()
            MonkiThemeMode.LIGHT -> false
            MonkiThemeMode.DARK -> true
        }
    val typography = remember { MonkiTypography() }
    val materialTypography = remember(typography) { typography.toMaterialTypography() }
    CompositionLocalProvider(
        LocalMonkiColors provides if (dark) MonkiDarkColors else MonkiLightColors,
        LocalMonkiTypography provides typography,
        LocalReducedMotion provides rememberSystemReducedMotion(),
    ) {
        MaterialTheme(
            colorScheme = if (dark) MonkiDarkColorScheme else MonkiLightColorScheme,
            typography = materialTypography,
            content = content,
        )
    }
}

/** The current theme's tokens, for components. */
object MonkiTheme {
    val colors: MonkiColors
        @Composable
        @ReadOnlyComposable
        get() = LocalMonkiColors.current

    val typography: MonkiTypography
        @Composable
        @ReadOnlyComposable
        get() = LocalMonkiTypography.current

    /** True when the system asks for no animation (animator duration scale 0). */
    val reducedMotion: Boolean
        @Composable
        @ReadOnlyComposable
        get() = LocalReducedMotion.current
}
