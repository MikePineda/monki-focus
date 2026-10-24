// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * Accessibility node text never reaches a log (docs/threat-model.md B4,
 * CLAUDE.md): `:detectors` main sources make no logging or printing call at
 * all, and stay pure Kotlin/JVM (no Android import, no I/O).
 */
class DetectorsPrivacyTest {
    private val mainSources =
        File(requireNotNull(System.getProperty("monki.projectDir")) { "monki.projectDir is not set" }, "src/main")

    private fun violations(forbidden: List<Regex>): List<String> =
        mainSources
            .walkTopDown()
            .filter { it.isFile && it.extension in setOf("kt", "java") }
            .flatMap { file ->
                file.readLines().mapIndexedNotNull { index, line ->
                    val source = line.trim()
                    if (forbidden.any { it.containsMatchIn(source) }) "${file.relativeTo(mainSources)}:${index + 1}: $source" else null
                }
            }.toList()

    @Test
    fun accessibility_text_is_never_logged() {
        val logging =
            listOf(
                Regex("""\b(Log|Timber|Logger|logger|log)\s*\.\s*[a-zA-Z]+\s*\("""),
                Regex("""\bprint(ln)?\s*\("""),
                Regex("""\bSystem\s*\.\s*(out|err)\b"""),
                Regex("""\bprintStackTrace\s*\("""),
                Regex("""^import\s+(android\.util\.Log|timber\.|java\.util\.logging|org\.slf4j)"""),
            )

        assertEquals("no logging in :detectors", emptyList<String>(), violations(logging))
    }

    @Test
    fun detector_sources_import_no_android_and_do_no_io() {
        val impure =
            listOf(
                Regex("""^import\s+(android|androidx|com\.google\.android)\."""),
                Regex("""^import\s+java\.(io|nio\.file|net)\b"""),
                Regex("""\bSystem\.(getenv|getProperty|currentTimeMillis|nanoTime)\("""),
            )

        assertEquals("keep :detectors pure", emptyList<String>(), violations(impure))
    }
}
