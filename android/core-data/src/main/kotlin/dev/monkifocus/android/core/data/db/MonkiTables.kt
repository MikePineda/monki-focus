// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

/** Table names of `monki.db`. A table is never renamed or dropped in the release that replaces it. */
object MonkiTables {
    const val RULESET_REVISION = "ruleset_revision"
    const val ESCALATION_STATE = "escalation_state"
    const val INTENTION = "intention"
    const val BYPASS_EVENT = "bypass_event"
    const val AW_BUCKET = "aw_bucket"
    const val AW_EVENT = "aw_event"
    const val ACTIVITY_BLOCK = "activity_block"
    const val UNLOCK_LEDGER = "unlock_ledger"
    const val INGEST_CURSOR = "ingest_cursor"

    /** Every table of the current version, in the order of `@Database(entities)`. */
    val ALL: List<String> =
        listOf(
            RULESET_REVISION,
            ESCALATION_STATE,
            INTENTION,
            BYPASS_EVENT,
            AW_BUCKET,
            AW_EVENT,
            ACTIVITY_BLOCK,
            UNLOCK_LEDGER,
            INGEST_CURSOR,
        )
}
