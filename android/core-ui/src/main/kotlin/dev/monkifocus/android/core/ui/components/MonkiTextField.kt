// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.theme.MonkiRadius
import dev.monkifocus.android.core.ui.theme.MonkiSpacing

/**
 * A text field with its label above and a helper row below: guidance left,
 * the [counter] right (tabular). The [helper] is neutral guidance, never an
 * error: when [helperEmphasised] it turns `ink-1`, never red. [onDone] runs
 * from the keyboard's Done action, so Enter submits only while the field has
 * focus. [fieldModifier] reaches the editable node (test tags, focus).
 */
@Composable
fun MonkiTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    placeholder: String,
    helper: String,
    counter: String,
    modifier: Modifier = Modifier,
    fieldModifier: Modifier = Modifier,
    helperEmphasised: Boolean = false,
    onDone: () -> Unit = {},
) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    val shape = RoundedCornerShape(MonkiRadius.radiusMd)
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceSm),
    ) {
        Text(text = label, color = colors.ink2, style = typography.label)
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = fieldModifier.fillMaxWidth(),
            textStyle = typography.body.copy(color = colors.ink1),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { onDone() }),
            singleLine = true,
            cursorBrush = SolidColor(colors.ink1),
            decorationBox = { innerTextField ->
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = MonkiSpacing.tap)
                            .background(colors.surface1, shape)
                            .border(1.dp, colors.lineStrong, shape)
                            .padding(horizontal = MonkiSpacing.spaceMd),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    if (value.isEmpty()) {
                        Text(text = placeholder, color = colors.ink3, style = typography.body)
                    }
                    innerTextField()
                }
            },
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceMd),
        ) {
            Text(
                text = helper,
                modifier = Modifier.weight(1f),
                color = if (helperEmphasised) colors.ink1 else colors.ink3,
                style = typography.caption,
            )
            Text(text = counter, color = colors.ink3, style = typography.caption)
        }
    }
}
