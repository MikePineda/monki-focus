// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import dev.monkifocus.android.core.domain.ports.Intention
import dev.monkifocus.android.core.domain.ports.IntentionOutcome
import dev.monkifocus.android.core.domain.ports.IntentionRepository
import dev.monkifocus.android.service.accessibility.gate.IntentionLog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import java.util.UUID

/** [IntentionLog] over the Room repository: minutes and word counts only, never the typed text. */
internal class RepositoryIntentionLog(
    private val repository: IntentionRepository,
    private val io: CoroutineScope,
) : IntentionLog {
    override fun started(
        group: String,
        minutes: Int,
        typedWords: Int,
        startedAt: String,
        endsAt: String,
    ) {
        io.launch {
            runCatching {
                repository.start(
                    Intention(
                        UUID.randomUUID().toString(),
                        group,
                        minutes,
                        typedWords,
                        guardianKeyVerified = false,
                        startedAt = startedAt,
                        endsAt = endsAt,
                    ),
                )
            }
        }
    }

    override fun ended(
        group: String,
        outcome: IntentionOutcome,
        at: String,
    ) {
        io.launch {
            runCatching { repository.open(group)?.let { repository.close(it.id, outcome, at) } }
        }
    }
}
