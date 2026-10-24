// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.buildlogic

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.plugins.JavaPluginExtension
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies
import org.jetbrains.kotlin.gradle.dsl.KotlinJvmProjectExtension

/**
 * `monki.jvm.library`: a pure Kotlin/JVM module (`:core-domain`,
 * `:detectors`, `:core-crypto`). No Android, so it builds and tests without
 * the Android SDK.
 */
class JvmLibraryConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("org.jetbrains.kotlin.jvm")

            extensions.configure<JavaPluginExtension> {
                sourceCompatibility = MONKI_JAVA_VERSION
                targetCompatibility = MONKI_JAVA_VERSION
            }
            extensions.configure<KotlinJvmProjectExtension> {
                compilerOptions.allWarningsAsErrors.set(true)
            }
            configureKotlinJvmTarget()
            configureTestTasks()

            dependencies {
                add("testImplementation", libs.library("junit4"))
            }

            // CI runs `testDebugUnitTest` across the build; this alias makes
            // that name cover the JVM test suites too (see android/README.md).
            tasks.register(JVM_TEST_ALIAS) {
                group = "verification"
                description = "Runs the JVM unit tests (alias used by the Android CI command)."
                dependsOn("test")
            }
        }
    }

    private companion object {
        const val JVM_TEST_ALIAS = "testDebugUnitTest"
    }
}
