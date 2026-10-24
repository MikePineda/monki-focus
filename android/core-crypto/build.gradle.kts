// SPDX-License-Identifier: AGPL-3.0-or-later

plugins {
    alias(libs.plugins.monki.jvm.library)
}

dependencies {
    implementation(project(":core-domain"))
    // tink-android is a plain jar: it runs on the JVM tests as well as on the device.
    implementation(libs.tink.android)

    // End-to-end check of a signed pack through the real loader.
    testImplementation(project(":detectors"))
}

// The bundled detector packs and the schemas join the test resources straight
// from packages/rules (nothing is copied).
val rulesPackage = rootProject.layout.projectDirectory.dir("../packages/rules")

tasks.processTestResources {
    from(rulesPackage) {
        include("schema/**", "detectors/**")
    }
}
