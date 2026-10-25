// SPDX-License-Identifier: AGPL-3.0-or-later

/// Intentions (SEMANTICS.md §5.2): a friction restriction is lifted while its
/// group's state is `active` and `now < intentionExpiresAt`. Leaving early
/// (`leave`) ends the intention, so it no longer lifts anything.
func isIntentionActive(_ states: [EscalationState], group: String, _ nowSeconds: Int) throws -> Bool {
    let state = escalationStateOf(states, group)
    guard state.phase == .active, let expiresAt = state.intentionExpiresAt else { return false }
    return nowSeconds < (try epochSecondsOf(expiresAt))
}
