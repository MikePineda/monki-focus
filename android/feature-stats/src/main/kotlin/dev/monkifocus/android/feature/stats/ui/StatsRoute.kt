// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import dev.monkifocus.android.feature.stats.model.StatsLoader
import dev.monkifocus.android.feature.stats.model.StatsViewModel

/** The statistics screen with its state holder; loads when shown, whenever [refreshKey] changes (the app resumed) and on retry. */
@Composable
fun StatsRoute(
    loader: StatsLoader,
    clock: () -> Long,
    onBack: () -> Unit,
    onFixUsageAccess: () -> Unit,
    refreshKey: Int,
    modifier: Modifier = Modifier,
) {
    val scope = rememberCoroutineScope()
    val model = remember(loader) { StatsViewModel(loader, clock, scope) }
    val state by model.state.collectAsState()
    LaunchedEffect(model, refreshKey) { model.refresh() }
    StatsScreen(state = state, onBack = onBack, onFixUsageAccess = onFixUsageAccess, onRetry = model::refresh, modifier = modifier)
}
