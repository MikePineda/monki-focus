// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// The escalation state of every app group (SEMANTICS.md §7), kept in
/// memory and moved only by `nextEscalation`. Quitting the app forgets it,
/// which restarts the levels at L0. Emergency overrides do not go through
/// it: `EmergencyOverrides` measures them on the monotonic clock.
@MainActor
public final class EscalationBook {
    private var states: [String: EscalationState] = [:]

    public init() {}

    public var all: [EscalationState] {
        states.keys.sorted().compactMap { states[$0] }
    }

    public func state(of group: String) -> EscalationState {
        states[group] ?? initialEscalationState(group)
    }

    /// Applies `event`; an invalid instant leaves the state unchanged.
    @discardableResult
    public func apply(_ event: EscalationEvent, to group: String, now: String) -> EscalationState {
        let current = state(of: group)
        do {
            let next = try nextEscalation(current, event: event, now: now, guardianLinked: false).state
            states[group] = next
            return next
        } catch {
            BlockingLog.failure("escalation event ignored", error)
            return current
        }
    }
}
