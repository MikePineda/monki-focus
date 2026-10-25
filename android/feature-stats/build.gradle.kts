// SPDX-License-Identifier: AGPL-3.0-or-later

plugins {
    alias(libs.plugins.monki.android.library)
    alias(libs.plugins.monki.android.compose)
}

android {
    namespace = "dev.monkifocus.android.feature.stats"
}

dependencies {
    implementation(project(":core-domain"))
    implementation(project(":core-ui"))
    implementation(libs.kotlinx.coroutines.core)

    testImplementation(libs.kotlinx.coroutines.test)
}
