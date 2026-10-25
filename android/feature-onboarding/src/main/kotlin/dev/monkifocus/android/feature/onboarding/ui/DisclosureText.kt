// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.ui

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R

/**
 * The accessibility prominent disclosure, word for word the same in
 * onboarding and when it is shown again to an armed user: what is read,
 * what is never read, stored or sent, and that leaving is always possible.
 */
@Composable
internal fun DisclosureText() {
    DisclosureHeading(R.string.onboarding_disclosure_title, title = true)
    DisclosureBody(R.string.onboarding_disclosure_intro)
    DisclosureHeading(R.string.onboarding_disclosure_reads_title)
    DisclosureBody(R.string.onboarding_disclosure_reads_apps)
    DisclosureBody(R.string.onboarding_disclosure_reads_url)
    DisclosureHeading(R.string.onboarding_disclosure_never_title)
    DisclosureBody(R.string.onboarding_disclosure_never_store)
    DisclosureBody(R.string.onboarding_disclosure_never_send)
    DisclosureBody(R.string.onboarding_disclosure_never_other)
    DisclosureBody(R.string.onboarding_disclosure_leave)
}

/** "Not now does not turn protection off — Exit and unlink does." */
@Composable
internal fun NotNowNote() {
    Text(
        text = stringResource(R.string.onboarding_disclosure_not_now_note),
        color = MonkiTheme.colors.ink3,
        style = MonkiTheme.typography.caption,
    )
}

@Composable
private fun DisclosureHeading(
    text: Int,
    title: Boolean = false,
) {
    Text(
        text = stringResource(text),
        color = MonkiTheme.colors.ink1,
        style = if (title) MonkiTheme.typography.title else MonkiTheme.typography.heading,
        modifier = Modifier.semantics { heading() },
    )
}

@Composable
private fun DisclosureBody(text: Int) {
    Text(text = stringResource(text), color = MonkiTheme.colors.ink2, style = MonkiTheme.typography.body)
}
