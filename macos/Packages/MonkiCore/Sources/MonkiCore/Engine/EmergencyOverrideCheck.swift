// SPDX-License-Identifier: AGPL-3.0-or-later

/// Emergency overrides (SEMANTICS.md §5.2, §13.7): scoped to one group (the
/// rule id, or `bedtime`). The group's state lifts its restriction while it
/// is `override_active` and `now < overrideEndsAt`.
func isOverrideActive(_ states: [EscalationState], group: String, _ nowSeconds: Int) throws -> Bool {
    let state = escalationStateOf(states, group)
    guard state.phase == .overrideActive, let endsAt = state.overrideEndsAt else { return false }
    return nowSeconds < (try epochSecondsOf(endsAt))
}
