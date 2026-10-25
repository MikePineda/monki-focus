// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.ui

import dev.monkifocus.android.core.domain.rules.Weekday

/** The fields of a weekly window as the user saves them: `HH:MM` start and end, and the days. */
internal data class WindowDraft(
    val start: String,
    val end: String,
    val days: List<Weekday>,
)
