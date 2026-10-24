// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.buildlogic

import com.android.build.api.dsl.LibraryExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies

/**
 * `monki.android.library`: an Android library module. Kotlin comes from
 * AGP 9's built-in Kotlin support, so no `org.jetbrains.kotlin.android`
 * plugin is applied. Unit tests run on the JVM with Robolectric available
 * for wiring tests.
 */
class AndroidLibraryConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("com.android.library")

            extensions.configure<LibraryExtension> {
                compileSdk = libs.intVersionOf("compileSdk")
                defaultConfig {
                    minSdk = libs.intVersionOf("minSdk")
                }
                compileOptions {
                    sourceCompatibility = MONKI_JAVA_VERSION
                    targetCompatibility = MONKI_JAVA_VERSION
                }
                testOptions {
                    targetSdk = libs.intVersionOf("targetSdk")
                    unitTests.isIncludeAndroidResources = true
                }
                lint {
                    targetSdk = libs.intVersionOf("targetSdk")
                    applyMonkiPolicy()
                }
            }
            configureKotlinJvmTarget()
            configureTestTasks()

            dependencies {
                add("testImplementation", libs.library("junit4"))
                add("testImplementation", libs.library("robolectric"))
                add("testImplementation", libs.library("androidx-test-core"))
            }
        }
    }
}
