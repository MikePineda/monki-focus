// SPDX-License-Identifier: AGPL-3.0-or-later

/// An AFK status that holds at an instant, for the `afkstatus` bucket.
public struct AfkObservation: Hashable, Sendable {
    public var status: AfkStatus
    /// Epoch seconds at which the status holds.
    public var at: Int
    /// Whether the status differs from the previous observation.
    public var isTransition: Bool

    public init(status: AfkStatus, at: Int, isTransition: Bool) {
        self.status = status
        self.at = at
        self.isTransition = isTransition
    }
}

/// The AFK state machine behind the AFK watcher (aw-watcher-afk semantics):
///
/// - Idle for at least `thresholdSeconds` is `afk`, dated back to the last
///   input; less is `not-afk`, observed at the last input, so a not-afk
///   event ends at the last input and the switch to afk never overlaps it.
/// - Sleep, display sleep, lock, another session in front and power off
///   force `afk` at once, until every engaged reason is released (wake,
///   unlock, ...); then the idle time decides again.
public struct AfkDetector: Sendable {
    public let thresholdSeconds: Int
    public private(set) var status: AfkStatus?
    public private(set) var awayReasons: Set<AwayReason> = []

    public init(thresholdSeconds: Int = CaptureTiming.afkThresholdSeconds) {
        self.thresholdSeconds = thresholdSeconds
    }

    /// Whether a sleep, lock or session reason holds the user away.
    public var isForcedAway: Bool {
        !awayReasons.isEmpty
    }

    /// One poll of the idle time (seconds since the last input event) at `now`.
    public mutating func sample(secondsSinceInput: Double, at now: Int) -> AfkObservation {
        if isForcedAway {
            return observe(.afk, at: now)
        }
        let idle = secondsSinceInput.isFinite ? max(0, Int(secondsSinceInput.rounded(.down))) : thresholdSeconds
        let lastInput = now - min(idle, max(0, now))
        if idle >= thresholdSeconds {
            return observe(.afk, at: status == .afk ? now : lastInput)
        }
        return observe(.notAfk, at: lastInput)
    }

    /// A power or session event at `now`; `secondsSinceInput` decides the
    /// status once the last away reason is released.
    public mutating func handle(_ event: SessionEvent, secondsSinceInput: Double, at now: Int) -> AfkObservation {
        if event.engagesReason {
            awayReasons.insert(event.reason)
        } else {
            awayReasons.remove(event.reason)
        }
        return sample(secondsSinceInput: secondsSinceInput, at: now)
    }

    private mutating func observe(_ next: AfkStatus, at instant: Int) -> AfkObservation {
        let isTransition = status != next
        status = next
        return AfkObservation(status: next, at: instant, isTransition: isTransition)
    }
}
