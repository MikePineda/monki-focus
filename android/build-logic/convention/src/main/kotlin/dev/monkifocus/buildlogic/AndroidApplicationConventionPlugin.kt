// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.buildlogic

import com.android.build.api.dsl.ApplicationExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies

/**
 * `monki.android.application`: the `:app` module. Adds the version from
 * `VERSION_NAME` in `gradle.properties`, a single universal APK without the
 * encrypted dependency block (IzzyOnDroid and F-Droid flag it) and R8 for
 * release. Signing lives in `app/build.gradle.kts`.
 */
class AndroidApplicationConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("com.android.application")
            val version = MonkiVersion.fromGradleProperty(providers.gradleProperty(VERSION_PROPERTY).get())

            extensions.configure<ApplicationExtension> {
                compileSdk = libs.intVersionOf("compileSdk")
                defaultConfig {
                    minSdk = libs.intVersionOf("minSdk")
                    targetSdk = libs.intVersionOf("targetSdk")
                    versionCode = version.code
                    versionName = version.name
                }
                compileOptions {
                    sourceCompatibility = MONKI_JAVA_VERSION
                    targetCompatibility = MONKI_JAVA_VERSION
                }
                buildTypes {
                    getByName("debug") {
                        applicationIdSuffix = ".debug"
                        versionNameSuffix = "-debug"
                    }
                    getByName("release") {
                        isMinifyEnabled = true
                        isShrinkResources = true
                        proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
                    }
                }
                dependenciesInfo {
                    includeInApk = false
                    includeInBundle = false
                }
                testOptions {
                    unitTests.isIncludeAndroidResources = true
                }
                lint {
                    checkDependencies = true
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

    private companion object {
        const val VERSION_PROPERTY = "VERSION_NAME"
    }
}
