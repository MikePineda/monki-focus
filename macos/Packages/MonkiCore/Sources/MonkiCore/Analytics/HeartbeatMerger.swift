// SPDX-License-Identifier: AGPL-3.0-or-later

// ActivityWatch heartbeat merging (SEMANTICS.md §10.1): a heartbeat with
// deep-equal data that starts inside `[last.timestamp, last end + pulsetime]`
// extends the last event; anything else opens a new event.

/// The last event extended by `next`, or nil when `next` must open a new event.
public func heartbeat(last: ActivityEvent?, next: ActivityEvent, pulsetime: Int) throws(EngineError) -> ActivityEvent? {
    guard let last, last.data == next.data else { return nil }
    let lastStart = try epochSecondsOf(last.timestamp)
    let nextStart = try epochSecondsOf(next.timestamp)
    if nextStart < lastStart || nextStart > lastStart + last.duration + pulsetime { return nil }
    return ActivityEvent(
        timestamp: last.timestamp,
        duration: max(last.duration, nextStart + next.duration - lastStart),
        data: last.data
    )
}

/// Applies `heartbeats` in order to a bucket's `events`, as aw-server does.
public func mergeHeartbeats(_ events: [ActivityEvent], heartbeats: [ActivityEvent], pulsetime: Int)
    throws(EngineError) -> [ActivityEvent]
{
    var result = events
    for next in heartbeats {
        if let merged = try heartbeat(last: result.last, next: next, pulsetime: pulsetime) {
            result[result.count - 1] = merged
        } else {
            result.append(next)
        }
    }
    return result
}
