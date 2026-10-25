// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.fakes

import dev.monkifocus.android.core.domain.ports.IngestCursorRepository

/** Cursors that only move forward, in memory. */
class InMemoryIngestCursorRepository : IngestCursorRepository {
    val values = HashMap<String, Long>()

    override suspend fun get(source: String): Long? = values[source]

    override suspend fun advance(
        source: String,
        epochMillis: Long,
    ): Long = maxOf(values[source] ?: Long.MIN_VALUE, epochMillis).also { values[source] = it }
}
