// SPDX-License-Identifier: AGPL-3.0-or-later

plugins {
    // Loaded once here so every module shares one classloader for them.
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.monki.spotless)
    id("monki.verify")
}
