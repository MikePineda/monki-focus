// SPDX-License-Identifier: AGPL-3.0-or-later

plugins {
    alias(libs.plugins.monki.jvm.library)
    alias(libs.plugins.kotlin.serialization)
}

dependencies {
    // Models mirror the JSON Schemas of packages/rules and decode strictly.
    api(libs.kotlinx.serialization.json)
    // RulesetValidator: the schemas plus the x-uniqueBy, x-registrableDomain and x-timeZone keywords.
    implementation(libs.json.schema.validator)
}

// Shared fixtures: the data directories of packages/rules join the test
// resources straight from the package (nothing is copied into this module),
// so Gradle tracks them as test inputs and reruns the tests when a fixture
// changes. The filter is scoped to this `from`: the module's own
// src/test/resources are untouched, and TypeScript sources and tooling stay out.
val rulesPackage = rootProject.layout.projectDirectory.dir("../packages/rules")
val expectSchemaV1 = providers.gradleProperty("monki.rules.expectSchemaV1").orElse("false")

tasks.processTestResources {
    from(rulesPackage) {
        include("schema/**", "data/**", "fixtures/**", "detectors/**")
    }
}

tasks.test {
    systemProperty("monki.rulesDir", rulesPackage.asFile.absolutePath)
    systemProperty("monki.rules.expectSchemaV1", expectSchemaV1.get())
}
