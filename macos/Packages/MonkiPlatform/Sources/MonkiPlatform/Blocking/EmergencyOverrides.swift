// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore

/// The app's emergency overrides: `EmergencyOverridePolicy` read on the
/// injected monotonic clock, with every grant written to the bypass outbox
/// before it lifts anything. Shared by the gate panel and the bedtime overlay.
///
/// An override is always granted after the wait, even if the outbox write
/// fails (the user is never trapped); the failure is logged by error type only.
@MainActor
public final class EmergencyOverrides {
    private let outbox: any BypassOutbox
    private let wall: any MonkiCore.Clock
    private let monotonic: any MonotonicClock
    private let newDedupeKey: () -> String
    public private(set) var policy = EmergencyOverridePolicy()

    public init(
        outbox: any BypassOutbox,
        wall: any MonkiCore.Clock,
        monotonic: any MonotonicClock,
        newDedupeKey: @escaping () -> String = { UUID().uuidString }
    ) {
        self.outbox = outbox
        self.wall = wall
        self.monotonic = monotonic
        self.newDedupeKey = newDedupeKey
    }

    /// The current monotonic reading the policy is asked at.
    public var now: Duration { monotonic.elapsed() }

    public func request(_ group: String) {
        policy.request(group, at: now)
    }

    public func cancel(_ group: String) {
        policy.cancel(group)
    }

    public func status(of group: String) -> EmergencyStatus {
        policy.status(of: group, at: now)
    }

    public func lifts(_ group: String) -> Bool {
        policy.lifts(group, at: now)
    }

    /// Grants the requests whose wait ran out and records each one in the outbox.
    @discardableResult
    public func advance() -> [EmergencyGrant] {
        let grants = policy.advance(to: now)
        guard !grants.isEmpty else { return [] }
        let instant = utcInstantOf(WallSeconds.of(wall))
        for grant in grants {
            guard
                let record = BypassEventRecord.emergencyOverride(
                    grant, occurredAt: instant, dedupeKey: newDedupeKey())
            else {
                BlockingLog.notice("bypass not recorded: invalid record")
                continue
            }
            do {
                try outbox.enqueue(record, enqueuedAt: instant)
            } catch {
                BlockingLog.failure("bypass not recorded", error)
            }
        }
        return grants
    }
}
