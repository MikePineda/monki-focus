// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import MonkiCoreTesting
import Testing

/// Capture invariants over seeded random streams (`CaptureGenerator`); a
/// failure names its seed, which reproduces the case.
@Suite("capture properties")
struct CapturePropertiesTests {
    private static let runs: [UInt64] = Array(1...400)
    private static let pulsetime = CaptureTiming.pulsetimeSeconds

    /// Runs the observations through an emitter and a buffer, flushing into
    /// a ledger after the marked steps and once at the end. A write fails
    /// (and is requeued) when `failing` says so.
    private func capture(
        _ steps: [CaptureStep], failing: (Int) -> Bool = { _ in false }
    ) throws -> [ActivityEvent] {
        var emitter = StateHeartbeatEmitter()
        var buffer = try HeartbeatBuffer(pulsetime: Self.pulsetime)
        var ledger = EventLedger()
        for (index, step) in steps.enumerated() {
            for heartbeat in emitter.observe(step.data, at: CaptureSamples.origin + step.offset) {
                try buffer.heartbeat(heartbeat)
            }
            if step.flushAfter {
                let batch = buffer.drain()
                if failing(index) {
                    try buffer.requeue(batch)
                } else {
                    ledger.apply(batch)
                }
            }
        }
        ledger.apply(buffer.drain())
        return ledger.events
    }

    private func intervals(_ events: [ActivityEvent]) throws -> [Interval] {
        try events.map { event in
            let start = try epochSecondsOf(event.timestamp)
            return Interval(start: start, end: start + event.duration)
        }
    }

    private func closed(_ steps: [CaptureStep], tail: Int) -> [CaptureStep] {
        steps + [CaptureStep(offset: (steps.last?.offset ?? 0) + tail, data: nil, flushAfter: false)]
    }

    @Test("captured events match the timeline whatever the flush points", arguments: runs)
    func capturedEventsMatchTheTimelineWhateverTheFlushPoints(seed: UInt64) throws {
        var generator = CaptureGenerator(seed: seed)
        let steps = closed(generator.stream(), tail: generator.int(0...20))

        let events = try capture(steps)

        #expect(
            events == CaptureModel.events(steps.map { ($0.offset, $0.data) }, pulsetime: Self.pulsetime), "seed \(seed)"
        )
    }

    @Test("consecutive events in a bucket never overlap", arguments: runs)
    func consecutiveEventsInABucketNeverOverlap(seed: UInt64) throws {
        var generator = CaptureGenerator(seed: seed)
        let steps = closed(generator.stream(), tail: generator.int(0...20))

        let spans = try intervals(capture(steps))

        #expect(zip(spans, spans.dropFirst()).allSatisfy { $0.end <= $1.start }, "seed \(seed)")
        #expect(spans.allSatisfy { $0.end >= $0.start }, "seed \(seed)")
    }

    @Test("a gap between consecutive events only ever covers stopped time", arguments: runs)
    func aGapBetweenConsecutiveEventsOnlyEverCoversStoppedTime(seed: UInt64) throws {
        var generator = CaptureGenerator(seed: seed)
        let steps = closed(generator.stream(), tail: generator.int(0...20))
        let stops = CaptureModel.stops(steps.map { ($0.offset, $0.data) })

        let spans = try intervals(capture(steps))
        let gaps = zip(spans, spans.dropFirst()).map { Interval(start: $0.end, end: $1.start) }

        #expect(subtractIntervals(gaps, stops).isEmpty, "seed \(seed)")
    }

    @Test("tracked time equals the time a state was observed, plus bridged stops", arguments: runs)
    func trackedTimeEqualsTheTimeAStateWasObservedPlusBridgedStops(seed: UInt64) throws {
        var generator = CaptureGenerator(seed: seed)
        let steps = closed(generator.stream(), tail: generator.int(0...20))
        let runs = CaptureModel.runs(steps.map { ($0.offset, $0.data) })
        let observed = runs.filter { $0.data != nil }.reduce(0) { $0 + $1.end - $1.start }

        let spans = try intervals(capture(steps))
        let tracked = spans.reduce(0) { $0 + $1.end - $1.start }
        let bridged = subtractIntervals(
            spans,
            CaptureModel.runs(steps.map { ($0.offset, $0.data) })
                .filter { $0.data != nil }
                .map { Interval(start: CaptureSamples.origin + $0.start, end: CaptureSamples.origin + $0.end) })

        #expect(tracked == observed + bridged.reduce(0) { $0 + $1.end - $1.start }, "seed \(seed)")
        #expect(
            subtractIntervals(bridged, CaptureModel.stops(steps.map { ($0.offset, $0.data) })).isEmpty, "seed \(seed)")
    }

    @Test("a failed write that is requeued loses nothing", arguments: runs)
    func aFailedWriteThatIsRequeuedLosesNothing(seed: UInt64) throws {
        var generator = CaptureGenerator(seed: seed)
        let steps = closed(generator.stream(), tail: generator.int(0...20))
        var failures = SeededGenerator(seed: seed &+ 7)
        let failing = (0..<steps.count).map { _ in Bool.random(using: &failures) }

        let events = try capture(steps) { failing[$0] }

        #expect(events == (try capture(steps)), "seed \(seed)")
    }

    @Test("the buffer merges raw heartbeats exactly like the shared analytics core", arguments: runs)
    func theBufferMergesRawHeartbeatsExactlyLikeTheSharedAnalyticsCore(seed: UInt64) throws {
        var generator = CaptureGenerator(seed: seed)
        let heartbeats = generator.heartbeats()
        var buffer = try HeartbeatBuffer(pulsetime: Self.pulsetime)
        var ledger = EventLedger()

        for heartbeat in heartbeats {
            try buffer.heartbeat(heartbeat)
            if generator.int(0...4) == 0 { ledger.apply(buffer.drain()) }
        }
        ledger.apply(buffer.drain())

        #expect(
            ledger.events == (try mergeHeartbeats([], heartbeats: heartbeats, pulsetime: Self.pulsetime)),
            "seed \(seed)")
    }

    @Test("the capture timeline never goes backwards", arguments: runs)
    func theCaptureTimelineNeverGoesBackwards(seed: UInt64) {
        var random = SeededGenerator(seed: seed)
        let wall = FixedClock(Date(timeIntervalSince1970: TimeInterval(CaptureSamples.origin)))
        let monotonic = FakeMonotonicClock()
        var timeline = CaptureTimeline()
        var previous = Int.min

        for _ in 0..<100 {
            let step = Double.random(in: 0...12, using: &random)
            monotonic.advance(by: .milliseconds(Int(step * 1_000)))
            wall.advance(
                by: step
                    + (Int.random(in: 0...9, using: &random) == 0 ? .random(in: -7_200...7_200, using: &random) : 0))
            let reading = timeline.read(wall: wall.now(), monotonic: monotonic.elapsed())

            #expect(reading.instant >= previous, "seed \(seed)")
            if let interruptedAt = reading.interruptedAt {
                #expect(previous <= interruptedAt && interruptedAt <= reading.instant, "seed \(seed)")
            }
            previous = reading.instant
        }
    }

    @Test("the afk bucket is continuous and forced away is always afk", arguments: runs)
    func theAfkBucketIsContinuousAndForcedAwayIsAlwaysAfk(seed: UInt64) throws {
        var random = SeededGenerator(seed: seed)
        var detector = AfkDetector()
        var emitter = StateHeartbeatEmitter()
        var buffer = try HeartbeatBuffer(pulsetime: Self.pulsetime)
        var now = CaptureSamples.origin
        var idle = 0.0

        for _ in 0..<120 {
            let elapsed = Int.random(in: 1...(Int.random(in: 0...9, using: &random) == 0 ? 900 : 5), using: &random)
            now += elapsed
            idle =
                Bool.random(using: &random)
                ? Double.random(in: 0...Double(elapsed), using: &random) : idle + Double(elapsed)
            let observation: AfkObservation
            if Int.random(in: 0...5, using: &random) == 0,
                let event = SessionEvent.allCases.randomElement(using: &random)
            {
                observation = detector.handle(event, secondsSinceInput: idle, at: now)
            } else {
                observation = detector.sample(secondsSinceInput: idle, at: now)
            }
            if detector.isForcedAway {
                #expect(observation.status == .afk, "seed \(seed)")
            }
            for heartbeat in emitter.observe(.afk(observation.status), at: observation.at) {
                try buffer.heartbeat(heartbeat)
            }
        }
        for heartbeat in emitter.observe(nil, at: now) {
            try buffer.heartbeat(heartbeat)
        }

        let spans = try intervals(buffer.drain())
        #expect(zip(spans, spans.dropFirst()).allSatisfy { $0.end == $1.start }, "seed \(seed)")
    }
}
