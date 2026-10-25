// SPDX-License-Identifier: AGPL-3.0-or-later

plugins {
    alias(libs.plugins.monki.android.library)
    alias(libs.plugins.monki.android.compose)
}

android {
    namespace = "dev.monkifocus.android.feature.rules"
}

dependencies {
    implementation(project(":core-domain"))
    implementation(project(":core-ui"))

    implementation(libs.androidx.activity.compose)
    implementation(libs.kotlinx.coroutines.core)
}

// The rule-change tests validate with the schemas and judge with the catalog
// of packages/rules, read in place.
val rulesPackage = rootProject.layout.projectDirectory.dir("../packages/rules")

tasks.withType<Test>().configureEach {
    systemProperty("monki.rulesDir", rulesPackage.asFile.absolutePath)
    inputs.dir(rulesPackage.dir("schema")).withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.dir(rulesPackage.dir("data")).withPathSensitivity(PathSensitivity.RELATIVE)
}
