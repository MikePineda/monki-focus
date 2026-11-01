// SPDX-License-Identifier: AGPL-3.0-or-later

/// Emergency overrides on the Mac (plan: 2 minutes of waiting, then 15
/// minutes of access, always recorded as a bypass event). One override per
/// escalation group (a rule id, or `bedtime`).
///
/// Every reading is a monotonic `Duration` (`MonotonicClock.elapsed()`), and
/// no wall-clock instant goes in: moving the system time can neither shorten
/// the wait nor extend the access. A request lifts nothing until `advance`
/// has turned it into an `EmergencyGrant`, so the bypass record always comes
/// first. The policy lives in memory: quitting the app or rebooting ends any
/// override, which can only tighten the rules again.
public struct EmergencyOverridePolicy: Hashable, Sendable {
    public static let waitDuration: Duration = .seconds(120)
    public static let accessDuration: Duration = .seconds(15 * 60)

    private enum Phase: Hashable, Sendable {
        case waiting(since: Duration)
        case active(since: Duration)
    }

    private var phases: [String: Phase] = [:]

    public init() {}

    /// The groups with a waiting or active override, sorted.
    public var groups: [String] { phases.keys.sorted() }

    /// Starts the wait for `group`; a request while one waits or is active changes nothing.
    public mutating func request(_ group: String, at monotonic: Duration) {
        if let phase = phases[group], case .active(let since) = phase, monotonic - since >= Self.accessDuration {
            phases[group] = .waiting(since: monotonic)
            return
        }
        guard phases[group] == nil else { return }
        phases[group] = .waiting(since: monotonic)
    }

    /// Drops a waiting request. A granted access is never taken back.
    public mutating func cancel(_ group: String) {
        guard case .waiting = phases[group] else { return }
        phases[group] = nil
    }

    /// Grants every request whose wait has run out (once each) and forgets ended accesses.
    public mutating func advance(to monotonic: Duration) -> [EmergencyGrant] {
        var grants: [EmergencyGrant] = []
        for group in groups {
            switch phases[group] {
            case .waiting(let since) where monotonic - since >= Self.waitDuration:
                phases[group] = .active(since: monotonic)
                grants.append(EmergencyGrant(group: group, waited: monotonic - since, access: Self.accessDuration))
            case .active(let since) where monotonic - since >= Self.accessDuration:
                phases[group] = nil
            default:
                break
            }
        }
        return grants
    }

    public func status(of group: String, at monotonic: Duration) -> EmergencyStatus {
        switch phases[group] {
        case .none:
            return .none
        case .waiting(let since):
            return .waiting(remaining: max(.zero, Self.waitDuration - Self.clamped(monotonic - since)))
        case .active(let since):
            let elapsed = Self.clamped(monotonic - since)
            return elapsed >= Self.accessDuration ? .none : .active(remaining: Self.accessDuration - elapsed)
        }
    }

    /// Whether a granted override lifts `group`'s restriction at `monotonic`.
    public func lifts(_ group: String, at monotonic: Duration) -> Bool {
        if case .active = status(of: group, at: monotonic) { return true }
        return false
    }

    /// A reading before the start (never on one boot) counts as no time elapsed.
    private static func clamped(_ elapsed: Duration) -> Duration { max(.zero, elapsed) }
}
