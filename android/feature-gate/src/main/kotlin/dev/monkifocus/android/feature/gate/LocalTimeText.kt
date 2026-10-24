// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

/** A local minute of the day (0…1439) in the current locale's short time format (24-hour in Spanish). */
@Composable
internal fun rememberLocalTimeText(minuteOfDay: Int): String {
    val locale = LocalConfiguration.current.locales[0]
    return remember(minuteOfDay, locale) {
        val time = LocalTime.of((minuteOfDay / MINUTES_PER_HOUR).coerceIn(0, 23), (minuteOfDay % MINUTES_PER_HOUR).coerceIn(0, 59))
        DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).withLocale(locale).format(time)
    }
}

private const val MINUTES_PER_HOUR = 60
