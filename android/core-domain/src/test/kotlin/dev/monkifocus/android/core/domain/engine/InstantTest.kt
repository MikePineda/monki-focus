// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.engine.RulesetFactory.aRuleset
import dev.monkifocus.android.core.domain.engine.RulesetFactory.aState
import dev.monkifocus.android.core.domain.fixtures.RulesPackage
import dev.monkifocus.android.core.domain.rules.ReasonCode
import dev.monkifocus.android.core.domain.rules.SiteObservation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset

/** SEMANTICS.md §1: instants are parsed strictly and written in UTC without fractions. */
class InstantTest {
    @Test
    fun rejects_text_that_is_not_an_rfc_3339_instant_with_an_offset() {
        listOf(
            "2026-10-26T10:00:00",
            "2026-10-26 10:00:00Z",
            "2026-10-26T10:00:00.5Z",
            "2026-10-26T10:00Z",
            "2026-10-26T10:00:00z",
            "2026-10-26T10:00:00+1100",
            "2026-13-01T00:00:00Z",
            "2026-04-31T00:00:00Z",
            "2026-02-29T00:00:00Z",
            "2026-10-26T24:00:00Z",
            "2026-10-26T10:60:00Z",
            "2026-10-26T10:00:60Z",
            "2026-10-26T10:00:00+24:00",
            "2026-10-26T10:00:00+10:60",
            "Mon, 26 Oct 2026 10:00:00 GMT",
            "tomorrow",
            "٢026-10-26T10:00:00Z",
        ).forEach { text -> assertThrows(text, InvalidInstantException::class.java) { epochSecondsOf(text) } }
    }

    @Test
    fun applies_explicit_offsets_both_ways() {
        assertEquals(epochSecondsOf("2026-10-25T23:00:00Z"), epochSecondsOf("2026-10-26T10:00:00+11:00"))
        assertEquals(epochSecondsOf("2026-10-25T23:00:00Z"), epochSecondsOf("2026-10-25T13:00:00-10:00"))
        assertEquals(LocalDate.of(2028, 2, 29).atStartOfDay().toEpochSecond(ZoneOffset.UTC), epochSecondsOf("2028-02-29T00:00:00Z"))
    }

    @Test
    fun writes_computed_instants_in_utc_without_fractions() {
        assertEquals("2026-10-25T23:00:00Z", utcInstantOf(epochSecondsOf("2026-10-26T10:00:00+11:00")))
    }

    @Test
    fun instant_of_floors_milliseconds() {
        val millis =
            LocalDate
                .of(2026, 10, 26)
                .atTime(10, 0)
                .toInstant(ZoneOffset.UTC)
                .toEpochMilli() + 999
        assertEquals("2026-10-26T10:00:00Z", instantOf(millis))
        assertEquals("1970-01-01T00:00:00Z", instantOf(0))
    }

    @Test
    fun instant_of_output_is_accepted_by_decide() {
        val now =
            instantOf(
                LocalDate
                    .of(2026, 10, 26)
                    .atTime(10, 0)
                    .toInstant(ZoneOffset.UTC)
                    .toEpochMilli() + 123,
            )
        val decision = decide(aRuleset(), SiteObservation("https://news.example.org/today"), aState(), now, RulesPackage.catalog)

        assertEquals(ReasonCode.NO_RULE, decision.reason)
    }

    @Test
    fun instant_of_rejects_a_negative_value_as_an_adapter_bug() {
        assertThrows(IllegalArgumentException::class.java) { instantOf(-1) }
    }
}
