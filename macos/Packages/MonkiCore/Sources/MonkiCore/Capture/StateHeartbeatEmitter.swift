// SPDX-License-Identifier: AGPL-3.0-or-later

/// Turns observations of a state ("the frontmost app is X at t", "the user
/// is away at t", "capture stopped at t") into ActivityWatch heartbeats.
///
/// A watcher is told about every change, so a state it observed at `t0` and
/// still observes at `t1` held for the whole of `[t0, t1]`. Each heartbeat
/// therefore starts at the previous observation and lasts until the new one
/// (the trick aw-watcher-afk uses), which always merges into the open event
/// whatever the pulsetime: continuous capture has no gaps even when timers
/// are throttled. A change at `t` closes the old state at `t` and opens the
/// new one at `t`, so consecutive events touch and never overlap.
///
/// Observation instants are clamped to never go backwards.
public struct StateHeartbeatEmitter: Sendable {
    /// The state last observed, nil while capture is stopped.
    public private(set) var current: EventData?
    private var since = 0
    private var latest: Int?

    public init() {}

    /// Records that `data` holds at `instant` (nil: capture stopped) and
    /// returns the heartbeats to apply, in order.
    public mutating func observe(_ data: EventData?, at instant: Int) -> [ActivityEvent] {
        let now = max(instant, latest ?? instant)
        latest = now
        var heartbeats: [ActivityEvent] = []
        if let current {
            heartbeats.append(ActivityEvent(timestamp: utcInstantOf(since), duration: now - since, data: current))
            if current == data {
                since = now
                return heartbeats
            }
        }
        current = data
        since = now
        if let data {
            heartbeats.append(ActivityEvent(timestamp: utcInstantOf(now), duration: 0, data: data))
        }
        return heartbeats
    }

    /// Capture was interrupted from `stop` to `resume` (the wall clock jumped
    /// forward): the current state closes at `stop` and reopens at `resume`.
    public mutating func interrupt(from stop: Int, to resume: Int) -> [ActivityEvent] {
        let state = current
        return observe(nil, at: stop) + observe(state, at: resume)
    }
}
