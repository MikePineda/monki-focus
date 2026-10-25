// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.bypass

import dev.monkifocus.android.core.domain.ports.BypassEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BypassRecordingTest {
    private val queued = mutableListOf<BypassEvent>()
    private val recorder = BypassRecorder({ queued += it }) { "4b1c2d3e-0000-4000-8000-000000000001" }

    @Test
    fun an_event_is_queued_with_utc_instants_and_codes_only() {
        recorder.record(BypassKind.ACCESSIBILITY_DISABLED, occurredAtEpochMs = 1_767_603_600_500)

        val event = queued.single()
        assertEquals("accessibility_disabled", event.kind)
        assertEquals("2026-01-05T09:00:00Z", event.occurredAt)
        assertEquals(event.occurredAt, event.detectedAt)
    }

    @Test
    fun a_detail_that_is_not_a_code_is_dropped_never_recorded() {
        recorder.record(BypassKind.EMERGENCY_OVERRIDE, 1_767_603_600_000, details = mapOf("target_group" to "https://example.org/page"))

        assertEquals(emptyMap<String, String>(), queued.single().details)
    }

    @Test
    fun a_failing_outbox_never_throws() {
        val failing = BypassRecorder({ error("outbox unavailable") }) { "id" }

        failing.record(BypassKind.PROTECTION_ENDED, 0)
    }

    @Test
    fun journal_lines_round_trip() {
        val event =
            BypassEvent(
                "id-1",
                "emergency_override",
                "2026-01-05T09:00:00Z",
                "2026-01-05T09:00:01Z",
                mapOf(
                    "target_group" to "rule-1",
                    "ends_at" to "2026-01-05T09:15:00Z",
                ),
            )

        assertEquals(event, BypassJournalCodec.decode(BypassJournalCodec.encode(event)))
    }

    @Test
    fun a_corrupt_journal_line_is_dropped() {
        assertNull(BypassJournalCodec.decode("id|kind"))
        assertNull(BypassJournalCodec.decode("id|Not A Code|2026-01-05T09:00:00Z|2026-01-05T09:00:00Z|"))
        assertNull(BypassJournalCodec.decode("id|emergency_override|2026-01-05T09:00:00Z|2026-01-05T09:00:00Z|broken"))
    }
}
