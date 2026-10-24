// SPDX-License-Identifier: AGPL-3.0-or-later

plugins {
    alias(libs.plugins.monki.jvm.library)
}

dependencies {
    implementation(project(":core-domain"))
    // tink-android is a plain jar: it runs on the JVM tests as well as on the device.
    implementation(libs.tink.android)
}
