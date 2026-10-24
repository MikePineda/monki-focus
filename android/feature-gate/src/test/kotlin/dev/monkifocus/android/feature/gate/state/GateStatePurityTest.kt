// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate.state

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** The gate state package is pure Kotlin: no Android, no I/O, no implicit clock, so it tests on the JVM. */
class GateStatePurityTest {
    private val stateSources =
        File(
            requireNotNull(System.getProperty("monki.projectDir")) { "monki.projectDir is not set" },
            "src/main/kotlin/dev/monkifocus/android/feature/gate/state",
        )

    private val forbidden =
        listOf(
            Regex("""^import\s+(android|androidx|com\.google\.android)\."""),
            Regex("""^import\s+java\.(io|nio\.file|net)\b"""),
            Regex("""\b(Instant|LocalDate|LocalDateTime|LocalTime|ZonedDateTime)\.now\("""),
            Regex("""\bSystem\.(currentTimeMillis|nanoTime)\("""),
        )

    @Test
    fun gate_state_sources_are_pure_kotlin() {
        val files = stateSources.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
        assertTrue("no sources found in $stateSources", files.isNotEmpty())

        val violations =
            files.flatMap { file ->
                file.readLines().mapIndexedNotNull { index, line ->
                    if (forbidden.any { it.containsMatchIn(line.trim()) }) "${file.name}:${index + 1}: ${line.trim()}" else null
                }
            }

        assertEquals(emptyList<String>(), violations)
    }
}
