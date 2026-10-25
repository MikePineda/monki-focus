// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.bypass

import dev.monkifocus.android.core.domain.ports.BypassEvent

/**
 * Port: queues a bypass event in the outbox (Room `BypassEventOutbox`). The
 * service writes it to a synchronous journal first, so an event recorded
 * while the process is being torn down (`onUnbind`) survives until the next
 * start re-queues it under the same id (enqueueing is idempotent).
 */
fun interface BypassSink {
    fun enqueue(event: BypassEvent)
}
