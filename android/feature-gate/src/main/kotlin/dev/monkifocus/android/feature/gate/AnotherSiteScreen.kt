// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiQuietButton
import dev.monkifocus.android.core.ui.components.MonkiSecondaryButton
import dev.monkifocus.android.core.ui.components.MonkiTextField

/**
 * "Go to another site" from a blocked or gated page: one field for a web
 * address or words to search, Go (enabled once something is typed), Cancel
 * back to the gate, and Close. The draft lives only in this screen; the
 * service checks a typed address with the engine before it is opened in
 * the same browser, so a blocked one shows its block instead.
 */
@Composable
fun AnotherSiteScreen(
    onGo: (address: String) -> Unit,
    onCancel: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var address by rememberSaveable { mutableStateOf("") }
    val canGo = address.isNotBlank()
    val go = { if (canGo) onGo(address.trim()) }
    val focusRequester = remember { FocusRequester() }
    GateLayout(modifier) {
        GateCloseButton(onClose)
        Text(
            text = stringResource(R.string.gate_another_site_title),
            color = MonkiTheme.colors.ink1,
            style = MonkiTheme.typography.title,
        )
        MonkiTextField(
            value = address,
            onValueChange = { address = it },
            label = stringResource(R.string.gate_another_site_label),
            placeholder = stringResource(R.string.gate_another_site_placeholder),
            helper = stringResource(R.string.gate_another_site_hint),
            counter = "",
            fieldModifier = Modifier.focusRequester(focusRequester).testTag(GateTestTags.ADDRESS),
            address = true,
            onDone = go,
        )
        MonkiSecondaryButton(
            text = stringResource(R.string.gate_another_site_go),
            onClick = go,
            modifier = Modifier.testTag(GateTestTags.GO),
            enabled = canGo,
        )
        MonkiQuietButton(
            text = stringResource(R.string.gate_another_site_cancel),
            onClick = onCancel,
            modifier = Modifier.testTag(GateTestTags.CANCEL_ADDRESS),
        )
    }
    // After Close's own focus request: the field takes focus so the keyboard comes up.
    LaunchedEffect(focusRequester) { focusRequester.requestFocus() }
}
