// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * The domain never reads the time on its own: every policy takes the wall
 * and monotonic clocks as parameters, so tests pin them and a manual clock
 * change on the device cannot leak in through a hidden `now()`.
 */
class ClockInjectionTest {
    @Test
    fun clock_is_injected_not_implicit() {
        val moduleDir = File(requireNotNull(System.getProperty("monki.projectDir")) { "monki.projectDir is not set" })
        val mainSources = File(moduleDir, "src/main")

        val violations = ImplicitClockScan.scan(mainSources)

        assertEquals("Inject the clock instead of reading it implicitly", emptyList<String>(), violations)
    }

    @Test
    fun implicit_clock_reads_are_detected() {
        val implicit =
            listOf(
                "val at = Instant.now()",
                "val day = LocalDate.now( )",
                "val ms = System.currentTimeMillis()",
                "val t = System.nanoTime()",
                "val c = Clock.systemUTC()",
                "val c = Clock.systemDefaultZone()",
                "val k = kotlin.time.Clock.System.now()",
                "val m = TimeSource.Monotonic.markNow()",
                "val d = Date()",
            )
        val injected =
            listOf(
                "val at = Instant.now(clock)",
                "val day = LocalDate.now(clock)",
                "fun decide(now: Instant, clock: Clock)",
            )

        implicit.forEach { line -> assertTrue(line, ImplicitClockScan.isImplicit(line)) }
        injected.forEach { line -> assertTrue(line, !ImplicitClockScan.isImplicit(line)) }
    }
}
