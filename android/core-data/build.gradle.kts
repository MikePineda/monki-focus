// SPDX-License-Identifier: AGPL-3.0-or-later

plugins {
    alias(libs.plugins.monki.android.library)
    alias(libs.plugins.ksp)
    alias(libs.plugins.room)
}

android {
    namespace = "dev.monkifocus.android.core.data"
}

// The exported schema of every database version is committed (additive
// migrations only; MigrationTestHelper reads these files from v2 on).
room {
    schemaDirectory("$projectDir/schemas")
}

dependencies {
    implementation(project(":core-domain"))

    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.kotlinx.coroutines.core)

    testImplementation(libs.kotlinx.coroutines.test)
}

// The manifest and schema tests read the source files directly.
tasks.withType<Test>().configureEach {
    inputs.file("src/main/AndroidManifest.xml").withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.dir("schemas").withPathSensitivity(PathSensitivity.RELATIVE)
}
