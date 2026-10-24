// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.buildlogic

import com.android.build.api.dsl.Lint

/**
 * Android Lint policy shared by every Android module. The i18n checks are
 * errors so a missing `values-es/` string, a stray translation or hardcoded
 * copy in a layout fails the build. No baseline file: nothing is grandfathered.
 */
internal fun Lint.applyMonkiPolicy() {
    abortOnError = true
    error += I18N_CHECKS
}

private val I18N_CHECKS = setOf("MissingTranslation", "ExtraTranslation", "HardcodedText")
