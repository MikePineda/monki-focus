// SPDX-License-Identifier: AGPL-3.0-or-later

plugins {
    alias(libs.plugins.monki.android.library)
    alias(libs.plugins.monki.android.compose)
}

android {
    namespace = "dev.monkifocus.android.core.ui"
}

// The catalog parity test reads the resource files directly.
tasks.withType<Test>().configureEach {
    inputs.dir("src/main/res").withPathSensitivity(PathSensitivity.RELATIVE)
}
