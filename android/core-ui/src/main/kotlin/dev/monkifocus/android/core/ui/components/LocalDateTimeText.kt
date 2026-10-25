// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import java.time.DateTimeException
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.time.format.FormatStyle

/**
 * A UTC instant (`2026-10-27T22:00:00Z`, the engine's form) as the device
 * shows a date and time: its own zone, the current locale's medium date and
 * short time. Unparseable text is shown as it is.
 */
@Composable
fun rememberLocalDateTimeText(utcInstant: String): String {
    val locale = LocalConfiguration.current.locales[0]
    return remember(utcInstant, locale) {
        try {
            DateTimeFormatter
                .ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)
                .withLocale(locale)
                .format(Instant.parse(utcInstant).atZone(ZoneId.systemDefault()))
        } catch (_: DateTimeParseException) {
            utcInstant
        } catch (_: DateTimeException) {
            utcInstant
        }
    }
}

/** A rule set's wall-clock `HH:MM` in the current locale's short time format (24-hour in Spanish). */
@Composable
fun rememberWallClockText(hhmm: String): String {
    val locale = LocalConfiguration.current.locales[0]
    return remember(hhmm, locale) {
        try {
            DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).withLocale(locale).format(LocalTime.parse(hhmm))
        } catch (_: DateTimeParseException) {
            hhmm
        }
    }
}
