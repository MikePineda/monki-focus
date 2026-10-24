// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

/**
 * The rule-set document with an append-only history (plan §3.1). Every
 * instant is a UTC RFC 3339 text (`2026-10-25T23:00:00Z`), the engine's `now`.
 *
 * - The **active** revision at `now` is the latest one whose `effectiveFrom`
 *   is at or before `now`; a pending revision becomes active by the passage
 *   of time alone, with no job to run.
 * - At most one revision is **pending** (`effectiveFrom` after `now`). A new
 *   change replaces it and never moves its `effectiveFrom` earlier
 *   (SEMANTICS.md §8): the stored instant is the later of the two.
 *
 * Single writer: every change goes through [commit], which is atomic and
 * serialised, so a reader never sees half a change and two edits never race.
 * Callers compute the change with `effectiveRuleSet(active, next, now,
 * pending?.effectiveFrom)` against what [active] and [pending] return.
 */
interface RulesetRepository {
    /** The revision in force at [now], or null before the first commit. */
    suspend fun active(now: String): StoredRuleset?

    /** The revision waiting to apply after [now], or null when nothing waits. */
    suspend fun pending(now: String): StoredRuleset?

    /**
     * Records [change] at [now]: `effectiveToday` applies from [now] and
     * `next` from `effectiveFrom` (from [now] when it is null), replacing any
     * pending revision. Answers the instant `next` applies from as stored.
     */
    suspend fun commit(
        change: RulesetChange,
        now: String,
    ): String
}
