// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

/**
 * Bypass events waiting to be reported to a paired server (phase 3), and the
 * day's list for the local statistics. Reporting is at-least-once: an event
 * stays unreported until the server acknowledged it. Instants are UTC RFC 3339
 * text.
 */
interface BypassEventOutbox {
    /** Queues [event]; answers false when its id is already queued (idempotent). */
    suspend fun enqueue(event: BypassEvent): Boolean

    /** The oldest [limit] unreported events, by occurrence. */
    suspend fun unreported(limit: Int): List<BypassEvent>

    /** Marks [ids] reported at [reportedAt]; already reported ones keep their first instant. */
    suspend fun markReported(
        ids: List<String>,
        reportedAt: String,
    )

    /** Events that occurred in `[from, to)`, reported or not, oldest first. */
    suspend fun occurredBetween(
        from: String,
        to: String,
    ): List<BypassEvent>

    /** Deletes reported events that occurred before [before]; unreported ones always stay. */
    suspend fun purgeReportedBefore(before: String): Int
}
