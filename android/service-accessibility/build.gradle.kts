// SPDX-License-Identifier: AGPL-3.0-or-later

plugins {
    alias(libs.plugins.monki.android.library)
    alias(libs.plugins.monki.android.compose)
}

android {
    namespace = "dev.monkifocus.android.service.accessibility"
}

dependencies {
    implementation(project(":core-domain"))
    implementation(project(":detectors"))
    implementation(project(":feature-gate"))
    implementation(project(":core-ui"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.kotlinx.coroutines.core)

    // Synthetic UI dumps (XmlUiDump) for the pipeline tests.
    testImplementation(testFixtures(project(":detectors")))
}

// The pipeline tests read the schemas, catalog data, detector packs and
// sanitised dumps of packages/rules in place; the manifest and config tests
// read the module's source files.
val rulesPackage = rootProject.layout.projectDirectory.dir("../packages/rules")

tasks.withType<Test>().configureEach {
    systemProperty("monki.rulesDir", rulesPackage.asFile.absolutePath)
    inputs.dir(rulesPackage.dir("schema")).withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.dir(rulesPackage.dir("data")).withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.dir(rulesPackage.dir("detectors")).withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.dir(rulesPackage.dir("fixtures/detectors")).withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.file("src/main/AndroidManifest.xml").withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.dir("src/main/res/xml").withPathSensitivity(PathSensitivity.RELATIVE)
}
