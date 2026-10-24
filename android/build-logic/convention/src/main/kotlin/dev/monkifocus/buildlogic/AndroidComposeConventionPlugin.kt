// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.buildlogic

import com.android.build.api.dsl.ApplicationExtension
import com.android.build.api.dsl.LibraryExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.dependencies

/**
 * `monki.android.compose`: Jetpack Compose on top of `monki.android.library`
 * or `monki.android.application` (apply one of those first). The Compose
 * compiler ships with Kotlin, so its version always matches the compiler.
 */
class AndroidComposeConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("org.jetbrains.kotlin.plugin.compose")

            extensions.findByType(LibraryExtension::class.java)?.buildFeatures?.compose = true
            extensions.findByType(ApplicationExtension::class.java)?.buildFeatures?.compose = true
            check(
                extensions.findByType(LibraryExtension::class.java) != null ||
                    extensions.findByType(ApplicationExtension::class.java) != null,
            ) { "monki.android.compose needs monki.android.library or monki.android.application first" }

            dependencies {
                val bom = platform(libs.library("compose-bom"))
                add("implementation", bom)
                add("implementation", libs.library("compose-ui"))
                add("implementation", libs.library("compose-foundation"))
                add("implementation", libs.library("compose-material3"))
                add("implementation", libs.library("compose-ui-tooling-preview"))
                add("debugImplementation", libs.library("compose-ui-tooling"))
                add("testImplementation", bom)
                add("testImplementation", libs.library("compose-ui-test-junit4"))
                add("debugImplementation", libs.library("compose-ui-test-manifest"))
            }
        }
    }
}
