// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiSecondaryButton
import dev.monkifocus.android.core.ui.components.MonkiSegmentedControl
import dev.monkifocus.android.core.ui.components.MonkiTextField
import dev.monkifocus.android.core.ui.theme.MonkiSpacing
import dev.monkifocus.android.feature.gate.state.GateUiState
import dev.monkifocus.android.feature.gate.state.IntentionRule

/**
 * "What are you here for?" (DESIGN.md §Interstitial 3–9): Close first, the
 * intention field (optional at L0–L1, at least three words from L2), the
 * 5/10/15 duration picker with no default, and "Continue to …", disabled
 * with a caption that says why until the choice is valid. Stateless: the
 * draft ([intention], [minutes]) is hoisted.
 */
@Composable
fun AskingScreen(
    state: GateUiState.Asking,
    intention: String,
    minutes: Int?,
    onIntentionChange: (String) -> Unit,
    onMinutesChange: (Int) -> Unit,
    onContinue: (intention: String, minutes: Int) -> Unit,
    onClose: () -> Unit,
    onEmergency: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    val canContinue = IntentionRule.canContinue(state, intention, minutes)
    val submit = {
        if (canContinue && minutes != null) onContinue(intention.trim(), minutes)
    }
    GateLayout(modifier) {
        GateContextLine(state.targetLabel)
        GateCloseButton(onClose)
        Text(text = stringResource(R.string.gate_intention_title), color = colors.ink1, style = typography.title)
        IntentionField(state, intention, onIntentionChange, onDone = submit)
        Column(verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceSm)) {
            Text(text = stringResource(R.string.gate_duration_label), color = colors.ink2, style = typography.label)
            MonkiSegmentedControl(
                labels = IntentionRule.DURATION_MINUTES.map { stringResource(R.string.gate_duration_minutes, it) },
                selectedIndex = IntentionRule.DURATION_MINUTES.indexOf(minutes).takeIf { it >= 0 },
                onSelect = { index -> onMinutesChange(IntentionRule.DURATION_MINUTES[index]) },
                modifier = Modifier.testTag(GateTestTags.DURATION),
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceSm)) {
            MonkiSecondaryButton(
                text = stringResource(R.string.gate_continue, state.targetLabel),
                onClick = submit,
                modifier = Modifier.testTag(GateTestTags.CONTINUE),
                enabled = canContinue,
            )
            blockedContinueReason(state, intention, minutes)?.let { reason ->
                Text(text = stringResource(reason), color = colors.ink3, style = typography.caption)
            }
        }
        GateLevelLine(state.level)
        GateEmergencyFooter(onEmergency)
    }
}

@Composable
private fun IntentionField(
    state: GateUiState.Asking,
    intention: String,
    onIntentionChange: (String) -> Unit,
    onDone: () -> Unit,
) {
    val required = state.requiresTypedIntention
    MonkiTextField(
        value = intention,
        onValueChange = onIntentionChange,
        label = stringResource(if (required) R.string.gate_intention_label_required else R.string.gate_intention_label_optional),
        placeholder = stringResource(PLACEHOLDERS[state.level.coerceAtLeast(0) % PLACEHOLDERS.size]),
        helper =
            if (required) {
                stringResource(R.string.gate_intention_hint_required, IntentionRule.MIN_WORDS)
            } else {
                stringResource(R.string.gate_intention_hint_optional)
            },
        counter = stringResource(R.string.gate_intention_word_count, IntentionRule.wordCount(intention)),
        fieldModifier = Modifier.testTag(GateTestTags.INTENTION),
        helperEmphasised = required && intention.isNotBlank() && !IntentionRule.meetsTypedRule(intention, state.previousIntention),
        onDone = onDone,
    )
}

/** Why Continue is disabled, or null when it is enabled. */
private fun blockedContinueReason(
    state: GateUiState.Asking,
    intention: String,
    minutes: Int?,
): Int? =
    when {
        state.requiresGuardianKey -> {
            R.string.gate_continue_needs_guardian_key
        }

        minutes !in IntentionRule.DURATION_MINUTES -> {
            R.string.gate_continue_needs_duration
        }

        state.requiresTypedIntention && !IntentionRule.meetsTypedRule(intention, state.previousIntention) -> {
            R.string.gate_continue_needs_intention
        }

        else -> {
            null
        }
    }

/** Neutral example intentions; the placeholder rotates with the level. */
private val PLACEHOLDERS =
    listOf(
        R.string.gate_intention_placeholder_reply,
        R.string.gate_intention_placeholder_hours,
        R.string.gate_intention_placeholder_lecture,
    )
