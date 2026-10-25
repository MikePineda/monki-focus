// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// Turns watcher observations into events and batch-writes them.
///
/// Per bucket a `StateHeartbeatEmitter` makes ActivityWatch heartbeats and a
/// `HeartbeatBuffer` merges them within `pulsetime` (the shared analytics
/// semantics), so consecutive events of a bucket touch while capture runs
/// and never overlap. Nothing reaches the store until `flush()`: every
/// `flushInterval` (10 s) once `startPeriodicFlush` runs, and on demand at
/// sleep, quit and AFK. A failed write is kept and retried by the next flush.
@MainActor
public final class HeartbeatQueue {
    private struct Lane {
        var emitter = StateHeartbeatEmitter()
        var buffer: HeartbeatBuffer
    }

    private let store: any EventStore
    private let pulsetime: Int
    private var lanes: [String: Lane] = [:]
    private var timer: (any RepeatingTimer)?

    public init(store: any EventStore, pulsetime: Int = CaptureTiming.pulsetimeSeconds) {
        self.store = store
        self.pulsetime = pulsetime
    }

    /// Creates the bucket if needed and seeds it with its latest stored
    /// event, so capture that resumes within pulsetime extends it.
    public func register(_ bucket: BucketDescriptor) throws {
        try store.register(bucket)
        lanes[bucket.id] = Lane(
            buffer: try HeartbeatBuffer(pulsetime: pulsetime, last: store.lastEvent(bucketId: bucket.id)))
    }

    /// The latest event end over every registered bucket: the capture timeline's floor.
    public var latestEnd: Int? {
        lanes.values.compactMap(\.buffer.lastEnd).max()
    }

    public var hasPendingWrites: Bool {
        lanes.values.contains { $0.buffer.hasPendingWrites }
    }

    /// `data` holds in the bucket at `instant`; nil stops the bucket's capture.
    public func record(_ data: EventData?, bucketId: String, at instant: Int) {
        guard var lane = lanes[bucketId] else { return }
        apply(lane.emitter.observe(data, at: instant), to: &lane)
        lanes[bucketId] = lane
    }

    /// The wall clock jumped forward: every bucket's state closes at `stop`
    /// and reopens at `resume`, so no event spans time that never passed.
    public func interrupt(from stop: Int, to resume: Int) {
        for (id, var lane) in lanes {
            apply(lane.emitter.interrupt(from: stop, to: resume), to: &lane)
            lanes[id] = lane
        }
    }

    /// Stops every bucket at `instant` (quit).
    public func stopAll(at instant: Int) {
        for id in lanes.keys {
            record(nil, bucketId: id, at: instant)
        }
    }

    /// Writes every pending event; returns false when a write failed (the
    /// events stay queued for the next flush).
    @discardableResult
    public func flush() -> Bool {
        var succeeded = true
        for (id, var lane) in lanes where lane.buffer.hasPendingWrites {
            let batch = lane.buffer.drain()
            do {
                try store.upsert(batch, bucketId: id)
            } catch {
                CaptureLog.failure("event batch write failed", error)
                try? lane.buffer.requeue(batch)
                succeeded = false
            }
            lanes[id] = lane
        }
        return succeeded
    }

    /// Flushes every `interval`, after `prepare` (which refreshes the
    /// observations that only change on events, like the frontmost app).
    public func startPeriodicFlush(
        timers: any RepeatingTimerScheduler,
        every interval: Duration = .seconds(CaptureTiming.flushSeconds),
        prepare: @escaping @MainActor @Sendable () -> Void = {}
    ) {
        timer?.cancel()
        timer = timers.schedule(every: interval) { [weak self] in
            prepare()
            self?.flush()
        }
    }

    public func stopPeriodicFlush() {
        timer?.cancel()
        timer = nil
    }

    private func apply(_ heartbeats: [ActivityEvent], to lane: inout Lane) {
        do {
            for heartbeat in heartbeats {
                try lane.buffer.heartbeat(heartbeat)
            }
        } catch {
            CaptureLog.failure("heartbeat rejected", error)
        }
    }
}
