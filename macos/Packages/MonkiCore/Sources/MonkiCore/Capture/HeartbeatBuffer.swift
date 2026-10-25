// SPDX-License-Identifier: AGPL-3.0-or-later

/// One bucket's heartbeats merged into events with ActivityWatch semantics
/// (`heartbeat(last:next:pulsetime:)`, SEMANTICS.md §10.1), plus the events
/// changed since the last `drain()`, ready to be written as one batch.
///
/// Every event is keyed by its start (epoch seconds): a bucket never holds
/// two events with the same start, so the store upserts on
/// `(bucket, start)` and writing a batch twice is harmless.
///
/// The buffer never lets two events overlap: a heartbeat that starts before
/// the last event's end is first moved to that end (an ActivityWatch server
/// would store the overlap). For heartbeats that start at or after the last
/// end, which is all `StateHeartbeatEmitter` produces, this changes nothing.
/// A zero-length last event is replaced by a new event at the same start.
public struct HeartbeatBuffer: Sendable {
    public let pulsetime: Int
    /// The latest event of the bucket: the one the next heartbeat may extend.
    public private(set) var last: ActivityEvent?
    private var lastStart = 0
    private var pending: [Int: ActivityEvent] = [:]

    /// `last` seeds the buffer with the bucket's latest stored event, so
    /// capture that resumes within `pulsetime` keeps extending it.
    public init(pulsetime: Int, last: ActivityEvent? = nil) throws(EngineError) {
        self.pulsetime = pulsetime
        if let last {
            self.last = last
            lastStart = try epochSecondsOf(last.timestamp)
        }
    }

    /// The end (epoch seconds) of the latest event, if any.
    public var lastEnd: Int? {
        last.map { lastStart + $0.duration }
    }

    /// Whether a `drain()` would return anything.
    public var hasPendingWrites: Bool {
        !pending.isEmpty
    }

    /// Applies one heartbeat: it extends the last event or opens a new one.
    public mutating func heartbeat(_ next: ActivityEvent) throws(EngineError) {
        let next = try clamped(next)
        if let merged = try MonkiCore.heartbeat(last: last, next: next, pulsetime: pulsetime) {
            last = merged
        } else {
            last = next
            lastStart = try epochSecondsOf(next.timestamp)
        }
        if let last {
            pending[lastStart] = last
        }
    }

    /// The events changed since the previous drain, in start order. Each is
    /// the latest state of its event; write them as upserts on the start.
    public mutating func drain() -> [ActivityEvent] {
        let batch = pending.sorted { $0.key < $1.key }.map(\.value)
        pending.removeAll()
        return batch
    }

    /// Puts back a batch whose write failed. An event changed again since
    /// the drain keeps its newer state.
    public mutating func requeue(_ batch: [ActivityEvent]) throws(EngineError) {
        for event in batch {
            let start = try epochSecondsOf(event.timestamp)
            if pending[start] == nil {
                pending[start] = event
            }
        }
    }

    /// `next` moved to start no earlier than the last event's end.
    private func clamped(_ next: ActivityEvent) throws(EngineError) -> ActivityEvent {
        guard let lastEnd else { return next }
        let start = try epochSecondsOf(next.timestamp)
        guard start < lastEnd else { return next }
        return ActivityEvent(
            timestamp: utcInstantOf(lastEnd),
            duration: max(0, start + next.duration - lastEnd),
            data: next.data
        )
    }
}
