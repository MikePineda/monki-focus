// SPDX-License-Identifier: AGPL-3.0-or-later

pluginManagement {
    includeBuild("build-logic")
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
    }
}

rootProject.name = "monki-focus-android"

// Pure Kotlin/JVM modules: build and test without the Android SDK.
include(":core-domain")
include(":detectors")
include(":core-crypto")

// Android modules.
include(":core-data")
include(":core-ui")
include(":service-accessibility")
include(":feature-gate")
include(":feature-onboarding")
include(":feature-stats")
include(":feature-rules")
include(":background")
include(":app")
