// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.buildlogic

import org.gradle.api.Project
import org.gradle.api.tasks.testing.Test
import org.gradle.api.tasks.testing.logging.TestExceptionFormat
import org.gradle.kotlin.dsl.withType

/** System property that points a test at its module directory (sources, resources, manifest). */
const val PROJECT_DIR_PROPERTY = "monki.projectDir"

internal fun Project.configureTestTasks() {
    val moduleDir = projectDir.absolutePath
    tasks.withType<Test>().configureEach {
        systemProperty(PROJECT_DIR_PROPERTY, moduleDir)
        testLogging {
            events("failed", "skipped")
            exceptionFormat = TestExceptionFormat.FULL
        }
    }
}
