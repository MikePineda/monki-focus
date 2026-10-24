// SPDX-License-Identifier: AGPL-3.0-or-later

plugins {
    `kotlin-dsl`
}

group = "dev.monkifocus.buildlogic"

dependencies {
    // Regular (not compileOnly) dependencies: the conventions apply these
    // plugins by id, so they must be on the classpath they hand to projects.
    implementation(libs.android.gradle.plugin)
    implementation(libs.kotlin.gradle.plugin)
    implementation(libs.compose.compiler.gradle.plugin)
    implementation(libs.spotless.gradle.plugin)

    testImplementation(libs.junit4)
}

gradlePlugin {
    plugins {
        register("monkiJvmLibrary") {
            id = "monki.jvm.library"
            implementationClass = "dev.monkifocus.buildlogic.JvmLibraryConventionPlugin"
        }
        register("monkiAndroidLibrary") {
            id = "monki.android.library"
            implementationClass = "dev.monkifocus.buildlogic.AndroidLibraryConventionPlugin"
        }
        register("monkiAndroidApplication") {
            id = "monki.android.application"
            implementationClass = "dev.monkifocus.buildlogic.AndroidApplicationConventionPlugin"
        }
        register("monkiAndroidCompose") {
            id = "monki.android.compose"
            implementationClass = "dev.monkifocus.buildlogic.AndroidComposeConventionPlugin"
        }
        register("monkiSpotless") {
            id = "monki.spotless"
            implementationClass = "dev.monkifocus.buildlogic.SpotlessConventionPlugin"
        }
        register("monkiVerify") {
            id = "monki.verify"
            implementationClass = "dev.monkifocus.buildlogic.VerifyConventionPlugin"
        }
    }
}
