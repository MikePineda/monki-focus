// SPDX-License-Identifier: AGPL-3.0-or-later

import javax.inject.Inject

plugins {
    alias(libs.plugins.monki.android.library)
    alias(libs.plugins.monki.android.compose)
}

android {
    namespace = "dev.monkifocus.android.core.ui"
}

dependencies {
    // The catalog tests check every engine reason code and explanation key.
    testImplementation(project(":core-domain"))
    testImplementation(libs.kotlinx.serialization.json)
}

/**
 * Copies the generated Compose token files of `packages/design-tokens` into
 * this module's build directory, so the theme always compiles against the
 * committed generator output and nobody edits a copy by hand.
 */
abstract class SyncDesignTokens : DefaultTask() {
    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val tokensDir: DirectoryProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @get:Inject
    abstract val fileSystem: FileSystemOperations

    @TaskAction
    fun sync() {
        fileSystem.sync {
            from(tokensDir) { include("*.kt") }
            into(outputDir)
        }
    }
}

val designTokensDist = rootProject.layout.projectDirectory.dir("../packages/design-tokens/dist")

val syncDesignTokens =
    tasks.register<SyncDesignTokens>("syncDesignTokens") {
        description = "Copies the generated Compose design tokens into the build directory."
        tokensDir.set(designTokensDist.dir("android"))
        outputDir.set(layout.buildDirectory.dir("generated/source/designTokens"))
    }

androidComponents {
    onVariants { variant ->
        variant.sources.kotlin?.addGeneratedSourceDirectory(syncDesignTokens, SyncDesignTokens::outputDir)
    }
}

// The catalog tests read the resource files directly; the token parity test
// compares the generated Kotlin values with tokens.json.
val designTokensJson = designTokensDist.file("tokens.json")

tasks.withType<Test>().configureEach {
    inputs.dir("src/main/res").withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.file(designTokensJson).withPathSensitivity(PathSensitivity.RELATIVE)
    systemProperty("monki.designTokensJson", designTokensJson.asFile.absolutePath)
}
