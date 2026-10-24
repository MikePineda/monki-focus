// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.buildlogic

import com.diffplug.gradle.spotless.SpotlessExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure

/**
 * `monki.spotless`: applied once, on the root project, and formats the
 * whole `android/` tree (modules and `build-logic/`) with ktlint. ktlint
 * reads its rules from `android/.editorconfig`.
 */
class SpotlessConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("com.diffplug.spotless")
            val ktlintVersion = libs.versionOf("ktlint")

            extensions.configure<SpotlessExtension> {
                kotlin {
                    target("**/*.kt")
                    targetExclude(GENERATED)
                    ktlint(ktlintVersion)
                    // Every Kotlin source starts with the SPDX header (repo rule).
                    licenseHeader(SPDX_HEADER, "(package |@file:|import )")
                }
                kotlinGradle {
                    target("**/*.gradle.kts")
                    targetExclude(GENERATED)
                    ktlint(ktlintVersion)
                }
            }
        }
    }

    private companion object {
        const val SPDX_HEADER = "// SPDX-License-Identifier: AGPL-3.0-or-later"

        // The bare directory patterns make Gradle prune those trees instead of
        // walking them, so spotless never races a task writing into build/.
        val GENERATED =
            listOf("**/build", "**/build/**", "**/.gradle", "**/.gradle/**", "**/.kotlin", "**/.kotlin/**")
    }
}
