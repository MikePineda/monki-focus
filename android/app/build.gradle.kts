// SPDX-License-Identifier: AGPL-3.0-or-later

plugins {
    alias(libs.plugins.monki.android.application)
    alias(libs.plugins.monki.android.compose)
}

android {
    namespace = "dev.monkifocus.android"

    defaultConfig {
        // Permanent once published: never derived from a personal handle.
        applicationId = "dev.monkifocus.android"
    }

    // Release signing only when ANDROID_KEYSTORE_PATH is set (a local signed
    // build). CI never sets it: release-please builds an unsigned APK and a
    // separate job signs it with apksigner (docs/RUNBOOK.md).
    val keystorePath = providers.environmentVariable("ANDROID_KEYSTORE_PATH").orNull
    if (!keystorePath.isNullOrBlank()) {
        fun requiredEnv(name: String): String =
            requireNotNull(providers.environmentVariable(name).orNull?.takeIf { it.isNotBlank() }) {
                "$name must be set when ANDROID_KEYSTORE_PATH is set"
            }
        signingConfigs {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = requiredEnv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = requiredEnv("ANDROID_KEY_ALIAS")
                keyPassword = requiredEnv("ANDROID_KEY_PASSWORD")
            }
        }
        buildTypes {
            getByName("release") {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
}

dependencies {
    implementation(project(":core-domain"))
    implementation(project(":core-crypto"))
    implementation(project(":core-data"))
    implementation(project(":core-ui"))
    implementation(project(":detectors"))
    implementation(project(":service-accessibility"))
    implementation(project(":feature-gate"))
    implementation(project(":feature-onboarding"))
    implementation(project(":feature-stats"))
    implementation(project(":feature-rules"))
    implementation(project(":background"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.androidx.work.runtime)
}

// The manifest test reads the source manifest directly.
tasks.withType<Test>().configureEach {
    inputs.file("src/main/AndroidManifest.xml").withPathSensitivity(PathSensitivity.RELATIVE)
}

/**
 * Copies the rules data the app reads at run time from packages/rules into
 * generated assets under `rules/`: the v1 schemas (validator), the catalog
 * data and starter preset (engine) and the bundled detector packs. Nothing
 * else of the package (TypeScript, tests, fixtures) reaches the APK.
 */
abstract class RulesAssetsTask : DefaultTask() {
    @get:Internal
    abstract val rulesDir: DirectoryProperty

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    val sources: FileTree get() = rulesDir.asFileTree.matching { include(*INCLUDES) }

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @get:Inject
    abstract val files: FileSystemOperations

    @TaskAction
    fun copy() {
        files.sync {
            from(rulesDir) {
                include(*INCLUDES)
                into("rules")
            }
            into(outputDir)
        }
    }

    private companion object {
        val INCLUDES = arrayOf("schema/v1/*.schema.json", "data/**/*.json", "detectors/android/*.pack.json")
    }
}

val rulesAssets =
    tasks.register<RulesAssetsTask>("rulesAssets") {
        rulesDir.set(rootProject.layout.projectDirectory.dir("../packages/rules"))
    }

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(rulesAssets, RulesAssetsTask::outputDir)
    }
}
