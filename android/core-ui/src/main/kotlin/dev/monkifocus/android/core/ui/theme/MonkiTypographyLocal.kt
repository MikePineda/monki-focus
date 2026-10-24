// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.runtime.staticCompositionLocalOf

/** The token text styles of the current theme (system face by default). */
val LocalMonkiTypography = staticCompositionLocalOf { MonkiTypography() }

/** Material 3 roles filled from the token styles, so stock components match. */
fun MonkiTypography.toMaterialTypography(): Typography =
    Typography(
        displayLarge = countdown,
        displayMedium = display,
        displaySmall = stat,
        headlineMedium = title,
        titleLarge = title,
        titleMedium = heading,
        bodyLarge = body,
        bodyMedium = bodySm,
        bodySmall = caption,
        labelLarge = bodyStrong,
        labelMedium = label,
        labelSmall = caption,
    )
