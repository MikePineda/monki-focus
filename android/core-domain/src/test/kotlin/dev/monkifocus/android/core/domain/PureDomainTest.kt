// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * `:core-domain` is pure Kotlin/JVM: no Android or AndroidX import, no I/O
 * in main sources (the clock is covered by [ClockInjectionTest]). The engine
 * takes the rules data and every input as parameters.
 */
class PureDomainTest {
    private val mainSources =
        File(requireNotNull(System.getProperty("monki.projectDir")) { "monki.projectDir is not set" }, "src/main")

    private val forbidden =
        listOf(
            Regex("""^import\s+(android|androidx|com\.google\.android)\."""),
            Regex("""^import\s+java\.(io|nio\.file|net\.(URL|HttpURLConnection|Socket))\b"""),
            Regex("""\bSystem\.(getenv|getProperty)\("""),
        )

    @Test
    fun domain_sources_import_no_android_and_do_no_io() {
        val violations =
            mainSources
                .walkTopDown()
                .filter { it.isFile && it.extension in setOf("kt", "java") }
                .flatMap { file ->
                    file.readLines().mapIndexedNotNull { index, line ->
                        val source = line.trim()
                        if (forbidden.any { it.containsMatchIn(source) }) "${file.relativeTo(mainSources)}:${index + 1}: $source" else null
                    }
                }.toList()

        assertEquals("Keep :core-domain pure", emptyList<String>(), violations)
    }
}
