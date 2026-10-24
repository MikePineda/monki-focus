// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui.theme

import android.provider.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalContext

/**
 * Reduced motion, Android's equivalent of `prefers-reduced-motion`: the user
 * turned animations off (`Settings.Global.ANIMATOR_DURATION_SCALE` = 0). The
 * breath circle then stays still and the progress line jumps.
 */
val LocalReducedMotion = staticCompositionLocalOf { false }

/** True for an animator duration scale of 0 ("Remove animations"). */
fun isReducedMotion(animatorDurationScale: Float): Boolean = animatorDurationScale == 0f

/** Reads the system setting once per context. */
@Composable
fun rememberSystemReducedMotion(): Boolean {
    val context = LocalContext.current
    return remember(context) {
        isReducedMotion(Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f))
    }
}
