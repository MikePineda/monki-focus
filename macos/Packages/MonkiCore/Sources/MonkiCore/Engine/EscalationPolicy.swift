// SPDX-License-Identifier: AGPL-3.0-or-later

// `nextEscalation(state, event, now, guardianLinked) → {state, effects}`
// (SEMANTICS.md §7.3). One state per target group. An event that does not
// apply in the current phase leaves the state unchanged; every event that
// changes it sets `lastActivityAt = now`.

/// An intention of an extension (§7.3 `pause_elapsed` with `pendingExtension`).
private let extensionSeconds = 300
/// Emergency override: wait, then grant (§7.3).
private let overrideWaitSeconds = 120
private let overrideSeconds = 15 * 60
/// A typed intention needs at least this many words (§7.3 `commit`).
private let minTypedWords = 3

/// Whether a timer has run out at `now` (a missing timer counts as run out).
private func hasPassed(_ timer: String?, _ nowSeconds: Int) throws -> Bool {
    guard let timer else { return true }
    return nowSeconds >= (try epochSecondsOf(timer))
}

private func toIdle(_ state: EscalationState) -> EscalationState {
    var next = state
    next.phase = .idle
    next.gate = nil
    next.pauseEndsAt = nil
    next.pendingExtension = false
    next.intentionExpiresAt = nil
    next.overrideReadyAt = nil
    next.overrideEndsAt = nil
    return next
}

/// Session check, one more attempt and the next gate: what a `visit` counts (§7.2, §7.3).
func visitOutcome(_ state: EscalationState, _ nowSeconds: Int, guardianLinked: Bool) throws
    -> (attemptCount: Int, brokenCount: Int, gate: Gate)
{
    let counters = try sessionCounters(state, nowSeconds)
    let attemptCount = min(counters.attemptCount + 1, maxAttemptCount)
    let gate = fullGate(
        attemptCount: attemptCount,
        brokenCount: counters.brokenCount,
        frictionType: nextFrictionType(state.lastFrictionType),
        guardianLinked: guardianLinked
    )
    return (attemptCount, counters.brokenCount, gate)
}

/// The state a `visit` produces in a phase that accepts one (§7.3 `visit`).
private func visitedState(_ state: EscalationState, _ nowSeconds: Int, guardianLinked: Bool) throws
    -> EscalationState
{
    let outcome = try visitOutcome(state, nowSeconds, guardianLinked: guardianLinked)
    var next = toIdle(state)
    next.phase = .pausing
    next.attemptCount = outcome.attemptCount
    next.brokenCount = outcome.brokenCount
    next.lastAttemptAt = utcInstantOf(nowSeconds)
    next.lastFrictionType = outcome.gate.frictionType
    next.gate = outcome.gate
    next.pauseEndsAt = utcInstantOf(nowSeconds + outcome.gate.pauseSeconds)
    return next
}

/// Whether a `visit` starts a new attempt in this state (§7.3: reloading never resets a pause).
private func acceptsVisit(_ state: EscalationState, _ nowSeconds: Int) throws -> Bool {
    switch state.phase {
    case .idle: true
    case .active: try hasPassed(state.intentionExpiresAt, nowSeconds)
    case .overrideActive: try hasPassed(state.overrideEndsAt, nowSeconds)
    default: false
    }
}

private func extended(_ state: EscalationState, _ nowSeconds: Int, guardianLinked: Bool) -> EscalationState {
    let brokenCount = min(state.brokenCount + 1, maxBrokenCount)
    let frictionType = nextFrictionType(state.lastFrictionType)
    let short = state.brokenCount < 2
    let gate =
        short
        ? extensionGate(
            attemptCount: state.attemptCount,
            brokenCount: brokenCount,
            frictionType: frictionType,
            guardianLinked: guardianLinked
        )
        : fullGate(
            attemptCount: state.attemptCount,
            brokenCount: brokenCount,
            frictionType: frictionType,
            guardianLinked: guardianLinked
        )
    var next = state
    next.phase = .pausing
    next.brokenCount = brokenCount
    next.lastFrictionType = frictionType
    next.gate = gate
    next.pauseEndsAt = utcInstantOf(nowSeconds + gate.pauseSeconds)
    next.pendingExtension = short
    next.intentionExpiresAt = nil
    return next
}

private func committed(
    _ state: EscalationState,
    minutes: Int,
    typedWords: Int,
    guardianKeyVerified: Bool,
    _ nowSeconds: Int
) -> EscalationState? {
    if state.gate?.requiresTypedIntention == true, typedWords < minTypedWords { return nil }
    if state.gate?.requiresGuardianKey == true, !guardianKeyVerified { return nil }
    var next = state
    next.phase = .active
    next.gate = nil
    next.pauseEndsAt = nil
    next.intentionExpiresAt = utcInstantOf(nowSeconds + minutes * 60)
    return next
}

/// The next state, or nil when the event does not apply in the current phase.
private func transition(_ state: EscalationState, _ event: EscalationEvent, _ nowSeconds: Int, guardianLinked: Bool)
    throws -> EscalationState?
{
    let phase = state.phase
    switch event {
    case .visit:
        return try acceptsVisit(state, nowSeconds)
            ? try visitedState(state, nowSeconds, guardianLinked: guardianLinked) : nil
    case .pauseElapsed:
        guard phase == .pausing, try hasPassed(state.pauseEndsAt, nowSeconds) else { return nil }
        var next = state
        if state.pendingExtension {
            next.phase = .active
            next.gate = nil
            next.pauseEndsAt = nil
            next.pendingExtension = false
            next.intentionExpiresAt = utcInstantOf(nowSeconds + extensionSeconds)
        } else {
            next.phase = .asking
        }
        return next
    case .close:
        return [.pausing, .asking, .overrideWaiting].contains(phase) ? toIdle(state) : nil
    case .commit(let minutes, let typedWords, let guardianKeyVerified):
        guard phase == .asking else { return nil }
        return committed(
            state,
            minutes: minutes,
            typedWords: typedWords,
            guardianKeyVerified: guardianKeyVerified,
            nowSeconds
        )
    case .intentionExpired:
        guard phase == .active, try hasPassed(state.intentionExpiresAt, nowSeconds) else { return nil }
        var next = state
        next.phase = .timedOut
        return next
    case .leave:
        return phase == .active || phase == .timedOut ? toIdle(state) : nil
    case .extend:
        return phase == .timedOut ? extended(state, nowSeconds, guardianLinked: guardianLinked) : nil
    case .emergencyRequest:
        // Every phase in which `decide` can gate or block: the user is never trapped.
        guard [.idle, .pausing, .asking, .active, .timedOut].contains(phase) else { return nil }
        var next = state
        next.phase = .overrideWaiting
        next.overrideReadyAt = utcInstantOf(nowSeconds + overrideWaitSeconds)
        if phase == .active { next.intentionExpiresAt = nil }
        return next
    case .emergencyWaitElapsed:
        guard phase == .overrideWaiting, try hasPassed(state.overrideReadyAt, nowSeconds) else { return nil }
        var next = state
        next.phase = .overrideActive
        next.overrideEndsAt = utcInstantOf(nowSeconds + overrideSeconds)
        return next
    case .emergencyExpired:
        guard phase == .overrideActive, try hasPassed(state.overrideEndsAt, nowSeconds) else { return nil }
        return toIdle(state)
    }
}

public func nextEscalation(_ state: EscalationState, event: EscalationEvent, now: String, guardianLinked: Bool)
    throws -> EscalationResult
{
    let nowSeconds = try epochSecondsOf(now)
    guard var next = try transition(state, event, nowSeconds, guardianLinked: guardianLinked) else {
        return EscalationResult(state: state, effects: [])
    }
    next.lastActivityAt = utcInstantOf(nowSeconds)
    return EscalationResult(state: next, effects: event == .emergencyWaitElapsed ? [.recordBypass] : [])
}
