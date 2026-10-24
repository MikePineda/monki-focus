// SPDX-License-Identifier: AGPL-3.0-or-later

plugins {
    alias(libs.plugins.monki.jvm.library)
    alias(libs.plugins.kotlin.serialization)
    `java-test-fixtures`
}

dependencies {
    // Packs are validated with the same schemas and validator as every rules document.
    api(project(":core-domain"))
}

// The detector packs, the schemas and the sanitised UI dumps of packages/rules
// join the test resources straight from the package (nothing is copied), so a
// pack or fixture change reruns the tests.
val rulesPackage = rootProject.layout.projectDirectory.dir("../packages/rules")

tasks.processTestResources {
    from(rulesPackage) {
        include("schema/**", "data/**", "detectors/**", "fixtures/detectors/**")
    }
}
