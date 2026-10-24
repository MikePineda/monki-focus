// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.validation

/** Why a rules document was rejected (SEMANTICS.md §1); the `invalid` fixtures name these codes. */
enum class RejectionCode(
    val code: String,
) {
    SCHEMA("schema"),
    DUPLICATE_KEY("duplicate_key"),
    INVALID_DOMAIN("invalid_domain"),
    INVALID_TIME_ZONE("invalid_time_zone"),
    TOO_LARGE("too_large"),
    INVALID_JSON("invalid_json"),
}
