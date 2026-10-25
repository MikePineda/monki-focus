// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * docs/threat-model.md B4: this module reads the screen, so it logs nothing
 * at all. Stronger than `scripts/ci/check-android-logging.sh`, which looks
 * for node text inside log calls: here any logger, print or stack-trace dump
 * in the module's sources fails, so node text cannot reach logcat by any
 * route, split across lines or not.
 */
class AccessibilityTextIsNeverLoggedTest {
    private val sources =
        File(requireNotNull(System.getProperty("monki.projectDir")) { "monki.projectDir is not set" }, "src/main")
            .walkTopDown()
            .filter { it.isFile && (it.extension == "kt" || it.extension == "java") }
            .toList()

    @Test
    fun accessibility_text_is_never_logged() {
        val logging =
            Regex(
                """\b(Log|Timber)\s*\.\s*[a-z]+\s*\(|\bprintln\s*\(|\bprint\s*\(|System\s*\.\s*(out|err)|printStackTrace\s*\(|import\s+android\.util\.Log\b""",
            )

        val hits =
            sources.flatMap { file ->
                file.readLines().mapIndexedNotNull {
                    index,
                    line,
                    ->
                    if (logging.containsMatchIn(line)) "${file.name}:${index + 1}" else null
                }
            }

        assertEquals("no logging in the accessibility module", emptyList<String>(), hits)
        assertEquals("the scan found the module's sources", true, sources.size > 10)
    }
}
