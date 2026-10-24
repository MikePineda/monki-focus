// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

/**
 * App theme, light and dark. Until `packages/design-tokens` ships the
 * semantic tokens (work package 2.6) it uses the Material 3 baseline
 * schemes, so no colour value is written here.
 */
@Composable
fun MonkiTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) darkColorScheme() else lightColorScheme(),
        content = content,
    )
}
