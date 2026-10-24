// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.buildlogic

import org.gradle.api.Project
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.withType

/**
 * JDK 21 module flags Robolectric needs at runtime. Its FileDescriptor
 * interceptor reaches `jdk.internal.access.SharedSecrets` and the private
 * `java.io.FileDescriptor` fields by reflection; without these every
 * Robolectric test fails with "Failed to interact with raw FileDescriptor
 * internals". Only for the Android modules' unit tests.
 */
val ROBOLECTRIC_JVM_ARGS: List<String> =
    listOf(
        "--add-exports=java.base/jdk.internal.access=ALL-UNNAMED",
        "--add-opens=java.base/jdk.internal.access=ALL-UNNAMED",
        "--add-opens=java.base/java.io=ALL-UNNAMED",
        "--add-opens=java.base/java.lang=ALL-UNNAMED",
    )

internal fun Project.configureRobolectricJvmArgs() {
    tasks.withType<Test>().configureEach {
        jvmArgs(ROBOLECTRIC_JVM_ARGS)
    }
}
