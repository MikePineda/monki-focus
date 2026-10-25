// SPDX-License-Identifier: AGPL-3.0-or-later

// The escalation session (SEMANTICS.md §7.2): attempts count in a session
// that resets when a `visit` arrives at least 2 hours after `lastActivityAt`
// (the last escalation event of any kind). There is no reset at midnight.

let sessionQuietSeconds = 7200

/// The initial state of a group: `idle`, counters 0, every timer null.
public func initialEscalationState(_ targetGroup: String) -> EscalationState {
    EscalationState(
        targetGroup: targetGroup,
        phase: .idle,
        attemptCount: 0,
        lastAttemptAt: nil,
        lastActivityAt: nil,
        brokenCount: 0,
        lastFrictionType: nil,
        gate: nil,
        pauseEndsAt: nil,
        pendingExtension: false,
        intentionExpiresAt: nil,
        overrideReadyAt: nil,
        overrideEndsAt: nil
    )
}

/// The stored state of a group, or the initial idle state when the group has none.
func escalationStateOf(_ states: [EscalationState], _ targetGroup: String) -> EscalationState {
    states.first { $0.targetGroup == targetGroup } ?? initialEscalationState(targetGroup)
}

/// Counters a visit at `nowSeconds` starts from: zero after two quiet hours.
func sessionCounters(_ state: EscalationState, _ nowSeconds: Int) throws -> (attemptCount: Int, brokenCount: Int) {
    if let lastActivityAt = state.lastActivityAt,
        nowSeconds - (try epochSecondsOf(lastActivityAt)) >= sessionQuietSeconds
    {
        return (0, 0)
    }
    return (state.attemptCount, state.brokenCount)
}
