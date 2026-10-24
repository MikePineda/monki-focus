// SPDX-License-Identifier: AGPL-3.0-or-later

plugins {
    alias(libs.plugins.monki.android.library)
}

android {
    namespace = "dev.monkifocus.android.service.accessibility"
}

dependencies {
    implementation(project(":core-domain"))
    implementation(project(":detectors"))
    implementation(project(":feature-gate"))
}

// The manifest test reads the source manifest directly.
tasks.withType<Test>().configureEach {
    inputs.file("src/main/AndroidManifest.xml").withPathSensitivity(PathSensitivity.RELATIVE)
}
