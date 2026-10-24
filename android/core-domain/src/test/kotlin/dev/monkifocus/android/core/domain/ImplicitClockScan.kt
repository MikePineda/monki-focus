// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain

import java.io.File

/** Finds source lines that read the time without an injected clock. */
object ImplicitClockScan {
    private val implicitReads =
        listOf(
            // `Instant.now()`, `LocalDate.now()`, …: the no-argument overloads use the system clock.
            Regex(
                """\b(Instant|LocalDate|LocalDateTime|LocalTime|ZonedDateTime|OffsetDateTime|OffsetTime|Year|YearMonth|MonthDay)\.now\(\s*\)""",
            ),
            Regex("""\bSystem\.(currentTimeMillis|nanoTime)\("""),
            Regex("""\bClock\.system(UTC|DefaultZone)?\("""),
            Regex("""\bClock\.System\b"""),
            Regex("""\bTimeSource\.Monotonic\b"""),
            Regex("""\bDate\(\s*\)"""),
        )

    fun isImplicit(line: String): Boolean = implicitReads.any { it.containsMatchIn(line) }

    /** Returns `path:line: source` for every offending line under [root]. */
    fun scan(root: File): List<String> =
        root
            .walkTopDown()
            .filter { it.isFile && it.extension in setOf("kt", "java") }
            .flatMap { file ->
                file.readLines().mapIndexedNotNull { index, line ->
                    if (isImplicit(line)) "${file.relativeTo(root)}:${index + 1}: ${line.trim()}" else null
                }
            }.toList()
}
