// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.bypass

import dev.monkifocus.android.core.domain.ports.BypassEvent

/**
 * One line per journalled bypass event: `id|kind|occurredAt|detectedAt|k=v;k=v`.
 * Every field is a code, an id or an instant (`BypassEvent` rejects `|`, `;`
 * and `=` in them), so the separators never clash. A line that does not
 * decode back into a valid event is dropped.
 */
object BypassJournalCodec {
    private const val FIELDS = 5

    fun encode(event: BypassEvent): String =
        listOf(
            event.id,
            event.kind,
            event.occurredAt,
            event.detectedAt,
            event.details.entries.joinToString(";") { "${it.key}=${it.value}" },
        ).joinToString("|")

    fun decode(line: String): BypassEvent? {
        val fields = line.split('|')
        if (fields.size != FIELDS) return null
        val details =
            fields[4]
                .split(';')
                .filter { it.isNotEmpty() }
                .map { it.split('=', limit = 2) }
        if (details.any { it.size != 2 }) return null
        return runCatching {
            BypassEvent(fields[0], fields[1], fields[2], fields[3], details.associate { it[0] to it[1] })
        }.getOrNull()
    }
}
