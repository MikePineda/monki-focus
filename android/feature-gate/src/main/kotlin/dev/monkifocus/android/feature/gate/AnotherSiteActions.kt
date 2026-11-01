// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiQuietButton
import dev.monkifocus.android.core.ui.components.MonkiSecondaryButton

/**
 * The ways out of a blocked or gated page that stay inside the browser:
 * "Go to another site" (the address entry) and "Go back" (BACK in the
 * browser). Shown only when the overlay passes the callbacks, i.e. over a
 * page in a browser, so a restored blocked tab never makes the whole
 * browser unusable.
 */
@Composable
internal fun AnotherSiteActions(
    onAnotherSite: (() -> Unit)?,
    onGoBack: (() -> Unit)?,
) {
    onAnotherSite?.let {
        MonkiSecondaryButton(
            text = stringResource(R.string.gate_another_site),
            onClick = it,
            modifier = Modifier.testTag(GateTestTags.ANOTHER_SITE),
        )
    }
    onGoBack?.let {
        MonkiQuietButton(
            text = stringResource(R.string.gate_go_back),
            onClick = it,
            modifier = Modifier.testTag(GateTestTags.GO_BACK),
        )
    }
}
