// SPDX-License-Identifier: AGPL-3.0-or-later

plugins {
    alias(libs.plugins.monki.android.library)
}

android {
    namespace = "dev.monkifocus.android.core.data"
}

dependencies {
    implementation(project(":core-domain"))
}

// The manifest test reads the source manifest directly.
tasks.withType<Test>().configureEach {
    inputs.file("src/main/AndroidManifest.xml").withPathSensitivity(PathSensitivity.RELATIVE)
}
