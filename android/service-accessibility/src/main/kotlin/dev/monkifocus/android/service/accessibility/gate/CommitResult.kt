// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.gate

/** What became of an intention submitted at the gate. */
enum class CommitResult {
    /** The intention runs: the gate lifts. */
    ACCEPTED,

    /** Fewer words than a typed intention needs (SEMANTICS.md §7.3 `commit`). */
    TOO_FEW_WORDS,

    /** The same intention as last time, which a typed intention must not be. */
    SAME_AS_LAST,

    /** The gate is not asking right now (the pause is still running, or it moved on). */
    NOT_ASKING,
}
