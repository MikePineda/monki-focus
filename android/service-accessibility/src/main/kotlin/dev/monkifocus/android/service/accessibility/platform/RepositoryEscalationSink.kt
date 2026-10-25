// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import dev.monkifocus.android.core.domain.ports.EscalationStateRepository
import dev.monkifocus.android.core.domain.rules.EscalationState
import dev.monkifocus.android.service.accessibility.gate.EscalationSink
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** [EscalationSink] over the Room repository, on the protection's serial I/O scope (writes keep their order). */
internal class RepositoryEscalationSink(
    private val repository: EscalationStateRepository,
    private val io: CoroutineScope,
) : EscalationSink {
    override fun persist(state: EscalationState) {
        io.launch { runCatching { repository.put(state) } }
    }
}
