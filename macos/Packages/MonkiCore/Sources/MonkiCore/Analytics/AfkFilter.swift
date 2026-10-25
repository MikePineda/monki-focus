// SPDX-License-Identifier: AGPL-3.0-or-later

/// Active time (SEMANTICS.md §10.3): events are cut to the time not covered
/// by AFK events with status `afk`. Audible web events are kept whole (a
/// lecture playing while the user listens). Pieces come in timestamp order
/// (stable); zero-length pieces are dropped.
public func activeTime(_ events: [ActivityEvent], afk afkEvents: [ActivityEvent]) throws(EngineError)
    -> [ActivityEvent]
{
    var away: [Interval] = []
    for event in afkEvents where event.data == .afk(.afk) {
        away.append(try event.interval())
    }
    var pieces: [(start: Int, event: ActivityEvent)] = []
    for event in events {
        var keepWhole = false
        if case .webTab(let tab) = event.data { keepWhole = tab.audible }
        for interval in subtractIntervals([try event.interval()], keepWhole ? [] : away) {
            let piece = ActivityEvent(
                timestamp: utcInstantOf(interval.start),
                duration: interval.end - interval.start,
                data: event.data
            )
            pieces.append((interval.start, piece))
        }
    }
    return pieces.enumerated()
        .sorted { $0.element.start != $1.element.start ? $0.element.start < $1.element.start : $0.offset < $1.offset }
        .map(\.element.event)
}
