// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.buildlogic

import org.gradle.api.Plugin
import org.gradle.api.Project

/**
 * `monki.verify`: applied on the root project; registers `verify`, the
 * Android PR gate (`./gradlew -p android verify`):
 * - `spotlessCheck` (ktlint on every `.kt` and `.gradle.kts`),
 * - the `build-logic` unit tests,
 * - `test` on every pure JVM module (shared `packages/rules` fixtures included),
 * - `lintDebug` and `testDebugUnitTest` (Robolectric) on every Android module,
 * - `:app:assembleDebug`.
 */
class VerifyConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        val verify =
            target.tasks.register("verify") {
                group = "verification"
                description = "Runs the Android PR gate: format, lint, every unit test and the debug build."
                dependsOn("spotlessCheck")
                dependsOn(target.gradle.includedBuild("build-logic").task(":convention:test"))
            }

        target.subprojects {
            val module = this
            pluginManager.withPlugin("monki.jvm.library") {
                verify.configure { dependsOn("${module.path}:test") }
            }
            pluginManager.withPlugin("com.android.library") {
                verify.configure { dependsOn("${module.path}:lintDebug", "${module.path}:testDebugUnitTest") }
            }
            pluginManager.withPlugin("com.android.application") {
                verify.configure {
                    dependsOn("${module.path}:lintDebug", "${module.path}:testDebugUnitTest", "${module.path}:assembleDebug")
                }
            }
        }
    }
}
