// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.buildlogic

import org.gradle.api.JavaVersion
import org.gradle.api.Project
import org.gradle.kotlin.dsl.withType
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.tasks.KotlinJvmCompile

/**
 * Bytecode level shared by every module. The build runs on JDK 21; the
 * pure JVM modules are consumed by the Android ones, so both emit Java 17
 * bytecode (D8 and Robolectric handle it on every supported API level).
 */
internal val MONKI_JAVA_VERSION: JavaVersion = JavaVersion.VERSION_17

internal fun Project.configureKotlinJvmTarget() {
    tasks.withType<KotlinJvmCompile>().configureEach {
        compilerOptions.jvmTarget.set(JvmTarget.fromTarget(MONKI_JAVA_VERSION.toString()))
    }
}
