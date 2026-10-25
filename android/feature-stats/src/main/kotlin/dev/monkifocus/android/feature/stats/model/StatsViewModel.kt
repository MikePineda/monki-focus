// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.model

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * The statistics screen's state holder: [refresh] loads through [loader] at
 * the [clock]'s now in [scope] (the screen's composition scope); a newer
 * refresh replaces a running one. A failure shows [StatsScreenState.Failed];
 * a refresh keeps the last state on screen until the new one is ready.
 */
class StatsViewModel(
    private val loader: StatsLoader,
    private val clock: () -> Long,
    private val scope: CoroutineScope,
) {
    private val mutableState = MutableStateFlow<StatsScreenState>(StatsScreenState.Loading)
    val state: StateFlow<StatsScreenState> = mutableState.asStateFlow()

    private var running: Job? = null

    fun refresh() {
        running?.cancel()
        running =
            scope.launch {
                mutableState.value =
                    try {
                        loader.load(clock())
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (_: Exception) {
                        StatsScreenState.Failed
                    }
            }
    }
}
