// SPDX-License-Identifier: AGPL-3.0-or-later

/// `relaxedWeekends` changes (SEMANTICS.md §8): tightening iff it ends
/// disabled (absent counts as disabled) or is unchanged. Turning it on
/// loosens and waits; while it waits `effectiveToday` keeps the old value.
func relaxedWeekendsChangeWaits(_ previous: RelaxedWeekends?, _ next: RelaxedWeekends?) -> Bool {
    let wasOn = previous?.enabled ?? false
    let isOn = next?.enabled ?? false
    return isOn && !wasOn
}
