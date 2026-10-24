// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.json.Json

/**
 * The JSON format of every rules document. Strict like the schemas: unknown
 * keys, missing required fields and type coercion are errors. Optional fields
 * at their default (`pendingTimeZone`, `path`, `gate`, …) are omitted when
 * encoding; required nullable fields (`EscalationState`) are always written.
 * Validate untrusted text with `RulesetValidator` first: decoding checks shape,
 * not patterns or `x-*` keywords.
 */
val RulesJson: Json =
    Json {
        ignoreUnknownKeys = false
        isLenient = false
        coerceInputValues = false
        explicitNulls = true
        encodeDefaults = false
        allowSpecialFloatingPointValues = false
    }
