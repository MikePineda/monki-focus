// SPDX-License-Identifier: AGPL-3.0-or-later

/// Bedtime changes (SEMANTICS.md §8): tightening iff bedtime becomes enabled,
/// or stays enabled with `days` and window whose week set contains the old
/// one. `warnMinutesBefore` is neutral; anything else waits.
func bedtimeChangeWaits(_ previous: Bedtime, _ next: Bedtime) -> Bool {
    if previous.enabled == next.enabled, previous.window == next.window { return false }
    if !next.enabled { return true }
    if !previous.enabled { return false }
    return !WeekSet([next.window]).contains(WeekSet([previous.window]))
}
