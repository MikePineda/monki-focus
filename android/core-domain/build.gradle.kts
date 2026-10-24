// SPDX-License-Identifier: AGPL-3.0-or-later

plugins {
    alias(libs.plugins.monki.jvm.library)
}

// Shared fixtures: packages/rules is a test resources dir, read in place (no
// copy), so Gradle tracks it as a test input and reruns the tests when a
// fixture changes.
val rulesPackage = rootProject.layout.projectDirectory.dir("../packages/rules")
val expectSchemaV1 = providers.gradleProperty("monki.rules.expectSchemaV1").orElse("false")

sourceSets.test {
    resources {
        srcDir(rulesPackage)
        exclude("**/node_modules/**")
    }
}

tasks.test {
    systemProperty("monki.rulesDir", rulesPackage.asFile.absolutePath)
    systemProperty("monki.rules.expectSchemaV1", expectSchemaV1.get())
}
