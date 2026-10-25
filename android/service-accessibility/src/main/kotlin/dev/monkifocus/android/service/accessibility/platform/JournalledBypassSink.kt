// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import dev.monkifocus.android.core.domain.ports.BypassEvent
import dev.monkifocus.android.core.domain.ports.BypassEventOutbox
import dev.monkifocus.android.service.accessibility.bypass.BypassJournalCodec
import dev.monkifocus.android.service.accessibility.bypass.BypassSink
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * Queues bypass events durably: the event is written to the synchronous
 * journal first, then to the Room outbox on [io]; once the outbox holds it
 * the journal line goes. [flush] re-queues whatever a dead process left in
 * the journal, under the same ids (the outbox ignores ids it already has),
 * so an `accessibility_disabled` recorded in `onUnbind` is never lost.
 */
class JournalledBypassSink(
    private val preferences: ProtectionPreferences,
    private val outbox: BypassEventOutbox,
    private val io: CoroutineScope,
) : BypassSink {
    override fun enqueue(event: BypassEvent) {
        val line = BypassJournalCodec.encode(event)
        runCatching { preferences.addToJournal(line) }
        store(event, line)
    }

    fun flush() {
        for (line in preferences.journal()) {
            val event = BypassJournalCodec.decode(line)
            if (event == null) {
                preferences.removeFromJournal(line)
            } else {
                store(event, line)
            }
        }
    }

    private fun store(
        event: BypassEvent,
        line: String,
    ) {
        io.launch {
            runCatching { outbox.enqueue(event) }.onSuccess { preferences.removeFromJournal(line) }
        }
    }
}
