// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import dev.monkifocus.android.core.domain.analytics.ActivitySource
import dev.monkifocus.android.core.domain.ports.UnlockStatus
import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.FrictionType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

/** What is on disk is the schema's code, never a Kotlin constant name. */
class MonkiTypeConvertersTest {
    private val converters = MonkiTypeConverters()

    @Test
    fun enums_are_stored_by_schema_code() {
        assertEquals("override_waiting", converters.phaseToCode(EscalationPhase.OVERRIDE_WAITING))
        assertEquals("type-intention", converters.frictionTypeToCode(FrictionType.TYPE_INTENTION))
        assertEquals("android", converters.sourceToCode(ActivitySource.ANDROID))
        assertEquals("revoked", converters.unlockStatusToCode(UnlockStatus.REVOKED))
    }

    @Test
    fun every_code_reads_back_to_its_value() {
        EscalationPhase.entries.forEach { assertEquals(it, converters.phaseOf(converters.phaseToCode(it))) }
        FrictionType.entries.forEach { assertEquals(it, converters.frictionTypeOf(converters.frictionTypeToCode(it))) }
        assertEquals(mapOf("a" to "1", "b" to "x"), converters.detailsOf(converters.detailsToJson(mapOf("b" to "x", "a" to "1"))))
    }

    @Test
    fun an_unknown_code_is_an_error_not_a_default() {
        assertThrows(IllegalArgumentException::class.java) { converters.phaseOf("sleeping") }
        assertThrows(IllegalArgumentException::class.java) { converters.unlockStatusOf("paused") }
    }
}
