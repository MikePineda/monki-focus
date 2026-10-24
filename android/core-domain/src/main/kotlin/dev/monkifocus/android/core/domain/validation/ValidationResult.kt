// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.validation

/** The outcome of validating a rules document. Errors name JSON pointers and keywords, never values. */
sealed class ValidationResult {
    data object Valid : ValidationResult()

    data class Rejected(
        val code: RejectionCode,
        val errors: List<String>,
    ) : ValidationResult()
}
