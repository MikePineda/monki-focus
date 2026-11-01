// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.SurfaceTarget
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiSecondaryButton
import dev.monkifocus.android.core.ui.components.MonkiToggleChip
import dev.monkifocus.android.core.ui.theme.MonkiSpacing
import dev.monkifocus.android.feature.rules.edit.MissingStarterRules
import dev.monkifocus.android.feature.rules.edit.SurfaceRuleOptions

/**
 * "Add rule": a site family, one of its feed surfaces and a mode (`hide-feed`
 * or `block`, [SurfaceRuleOptions]), added with one button; and, when the
 * [starter] preset has surface rules the configured set lacks, a one-tap
 * "Add suggested rules". Both are pure edits handed to [RulesActions.onEdit]
 * (adding a rule only tightens, so the policy applies it at once).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun SurfaceRulePicker(
    configured: Ruleset,
    options: SurfaceRuleOptions,
    starter: Ruleset?,
    actions: RulesActions,
) {
    val families = options.families
    if (families.isEmpty() && starter == null) return
    Text(
        text = stringResource(R.string.rules_add_body),
        color = MonkiTheme.colors.ink2,
        style = MonkiTheme.typography.body,
    )
    var family by remember(families) { mutableStateOf(families.firstOrNull()) }
    val surfaces = family?.let(options::surfacesOf).orEmpty()
    var surfaceId by remember(family) { mutableStateOf(surfaces.firstOrNull()?.id) }
    val surface = surfaces.firstOrNull { it.id == surfaceId }
    var mode by remember(surfaceId) { mutableStateOf(surface?.let(SurfaceRuleOptions::defaultMode) ?: RuleMode.HIDE_FEED) }

    if (families.isNotEmpty()) {
        Column(verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceSm)) {
            Label(R.string.rules_add_family)
            Chips(families, family, RulesTestTags::addFamily, { RulesText.family(it) }) { family = it }
            Label(R.string.rules_add_surface)
            Chips(surfaces.map { it.id }, surfaceId, RulesTestTags::addSurface, { RulesText.surface(it) }) { surfaceId = it }
            Label(R.string.rules_add_mode)
            Chips(SurfaceRuleOptions.MODES, mode, { RulesTestTags.addMode(it.name.lowercase()) }, { stringResource(RulesText.mode(it)) }) {
                mode = it
            }
            MonkiSecondaryButton(
                text = stringResource(R.string.rules_add_save),
                onClick = { surface?.let { picked -> actions.onEdit { SurfaceRuleOptions.add(it, picked.id, mode) } } },
                modifier = Modifier.testTag(RulesTestTags.ADD_SAVE),
                enabled = surface != null,
            )
        }
    }

    val missing = starter?.let { MissingStarterRules.of(configured, it) }.orEmpty()
    if (starter != null && missing.isNotEmpty()) {
        val names =
            missing.map { RulesText.target(it.target as SurfaceTarget) }.joinToString(stringResource(R.string.rules_detail_separator))
        Text(
            text = stringResource(R.string.rules_suggested_body, names),
            color = MonkiTheme.colors.ink2,
            style = MonkiTheme.typography.body,
        )
        MonkiSecondaryButton(
            text = stringResource(R.string.rules_suggested_add),
            onClick = { actions.onEdit { MissingStarterRules.addTo(it, starter) } },
            modifier = Modifier.testTag(RulesTestTags.SUGGESTED_ADD),
        )
    }
}

@Composable
private fun Label(text: Int) {
    Text(text = stringResource(text), color = MonkiTheme.colors.ink2, style = MonkiTheme.typography.label)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun <T> Chips(
    values: List<T>,
    selected: T?,
    tag: (T) -> String,
    label: @Composable (T) -> String,
    onSelect: (T) -> Unit,
) {
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceXs),
        verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceXs),
    ) {
        values.forEach { value ->
            MonkiToggleChip(
                label = label(value),
                checked = value == selected,
                onCheckedChange = { onSelect(value) },
                modifier = Modifier.testTag(tag(value)),
            )
        }
    }
}
