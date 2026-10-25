// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import os

/// Hands browser heartbeats from the bridge's connection queues to the main
/// actor (where `BrowserActivityRecorder` and the capture queue live) through
/// a bounded buffer: at most `capacity` heartbeats wait, the excess is
/// dropped, and at most one main-actor drain is scheduled at a time, so a
/// flood costs a fixed amount of memory and never piles up tasks.
public final class BrowserActivityInbox: Sendable {
    public typealias Item = (heartbeat: BrowserActivityPayload, browser: HelloPayload.Browser)

    private struct State {
        var pending: [Item] = []
        var drainScheduled = false
        var dropped = 0
    }

    public static let defaultCapacity = 256

    private let capacity: Int
    private let deliver: @MainActor @Sendable ([Item]) -> Void
    private let state = OSAllocatedUnfairLock(initialState: State())

    public init(capacity: Int = defaultCapacity, deliver: @escaping @MainActor @Sendable ([Item]) -> Void) {
        self.capacity = capacity
        self.deliver = deliver
    }

    /// Heartbeats dropped because the buffer was full.
    public var droppedCount: Int {
        state.withLock { $0.dropped }
    }

    /// Queues one heartbeat; returns false when it was dropped.
    @discardableResult
    public func enqueue(_ heartbeat: BrowserActivityPayload, from browser: HelloPayload.Browser) -> Bool {
        let (accepted, schedule) = state.withLock { state -> (Bool, Bool) in
            guard state.pending.count < capacity else {
                state.dropped += 1
                return (false, false)
            }
            state.pending.append((heartbeat, browser))
            let schedule = !state.drainScheduled
            state.drainScheduled = true
            return (true, schedule)
        }
        if schedule {
            Task { @MainActor [self] in self.drain() }
        }
        return accepted
    }

    @MainActor
    private func drain() {
        let batch = state.withLock { state -> [Item] in
            let batch = state.pending
            state.pending = []
            state.drainScheduled = false
            return batch
        }
        deliver(batch)
    }
}
