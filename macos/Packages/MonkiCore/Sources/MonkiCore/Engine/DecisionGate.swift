// SPDX-License-Identifier: AGPL-3.0-or-later

// The gate `decide` returns for a friction restriction without a lift
// (SEMANTICS.md §7.4):
//
// - in `pausing` or `asking`: the winner group's current gate;
// - in `timed_out` or `override_waiting` (a visit changes nothing there): the
//   current gate without a new attempt;
// - otherwise the gate a `visit` would produce now, on the **effective
//   state**: escalation is shared by every matching friction candidate, so a
//   new rule id never resets it. Adapters call `nextEscalation` for the
//   winner's group with that effective state (`effectiveEscalationState`),
//   so the stored gate equals the returned one.
//
// The relaxed bedtime (§5.2 step 4) uses the same gate for the `bedtime`
// group alone: no rule shares its escalation.

private func lastActivitySeconds(_ state: EscalationState) throws -> Int? {
    try state.lastActivityAt.map { try epochSecondsOf($0) }
}

/// The other friction groups sharing the winner's escalation: every friction rule but the winner.
private func otherGroupsOf(winner: Rule, frictionRules: [Rule]) -> [String] {
    frictionRules.filter { $0.id != winner.id }.map(\.id)
}

/// The winner group's state with the counters every matching friction group
/// shares: the maxima of the session-checked counters, and the friction type
/// of the group with the latest activity (ties: the winner's, then the
/// smallest rule id).
func effectiveEscalationState(
    winner: Rule,
    frictionRules: [Rule],
    states: [EscalationState],
    nowSeconds: Int
) throws -> EscalationState {
    try effectiveEscalationState(
        group: winner.id,
        otherGroups: otherGroupsOf(winner: winner, frictionRules: frictionRules),
        states: states,
        nowSeconds: nowSeconds
    )
}

/// `effectiveEscalationState` by group id: `group` is the winner's and
/// `otherGroups` share its counters (none for the relaxed bedtime, §7.4).
func effectiveEscalationState(
    group: String,
    otherGroups: [String],
    states: [EscalationState],
    nowSeconds: Int
) throws -> EscalationState {
    let own = escalationStateOf(states, group)
    // Other groups in id order, so a tie between them never depends on rule order.
    let others = otherGroups.filter { $0 != group }.sorted(by: CodeUnitOrder.less)
        .map { escalationStateOf(states, $0) }
    var attemptCount = 0
    var brokenCount = 0
    var latest = own
    var latestSeconds = try lastActivitySeconds(own)
    for state in [own] + others {
        let counters = try sessionCounters(state, nowSeconds)
        attemptCount = max(attemptCount, counters.attemptCount)
        brokenCount = max(brokenCount, counters.brokenCount)
        if let seconds = try lastActivitySeconds(state), latestSeconds.map({ seconds > $0 }) ?? true {
            latest = state
            latestSeconds = seconds
        }
    }
    // Counters are already session-checked: the visit must not reset them again.
    var effective = own
    effective.attemptCount = attemptCount
    effective.brokenCount = brokenCount
    effective.lastFrictionType = latest.lastFrictionType
    effective.lastActivityAt = nil
    return effective
}

/// `effectiveEscalationState` for adapters: the winner (`decision.ruleId`) and
/// the friction candidates (`frictionCandidates`) at `now`.
public func effectiveEscalationState(
    winner: Rule,
    frictionRules: [Rule],
    states: [EscalationState],
    now: String
) throws -> EscalationState {
    try effectiveEscalationState(
        winner: winner,
        frictionRules: frictionRules,
        states: states,
        nowSeconds: try epochSecondsOf(now)
    )
}

func decisionGate(
    winner: Rule,
    frictionRules: [Rule],
    states: [EscalationState],
    nowSeconds: Int,
    guardianLinked: Bool
) throws -> Gate {
    try decisionGate(
        group: winner.id,
        otherGroups: otherGroupsOf(winner: winner, frictionRules: frictionRules),
        states: states,
        nowSeconds: nowSeconds,
        guardianLinked: guardianLinked
    )
}

/// The gate of §7.4 for the escalation group `group`, sharing counters with `otherGroups`.
func decisionGate(
    group: String,
    otherGroups: [String],
    states: [EscalationState],
    nowSeconds: Int,
    guardianLinked: Bool
) throws -> Gate {
    let own = escalationStateOf(states, group)
    if own.phase == .pausing || own.phase == .asking, let gate = own.gate { return gate }
    if own.phase == .timedOut || own.phase == .overrideWaiting {
        return fullGate(
            attemptCount: own.attemptCount,
            brokenCount: own.brokenCount,
            frictionType: own.lastFrictionType ?? .countdown,
            guardianLinked: guardianLinked
        )
    }
    let effective = try effectiveEscalationState(
        group: group,
        otherGroups: otherGroups,
        states: states,
        nowSeconds: nowSeconds
    )
    return try visitOutcome(effective, nowSeconds, guardianLinked: guardianLinked).gate
}
