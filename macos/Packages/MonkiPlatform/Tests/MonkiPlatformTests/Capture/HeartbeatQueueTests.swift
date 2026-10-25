// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform
import Testing

@MainActor
@Suite("heartbeat queue")
struct HeartbeatQueueTests {
    private typealias E = SampleEvents

    private let store: RecordingEventStore
    private let queue: HeartbeatQueue
    private let bucket = SampleEvents.bucket(.currentWindow)
    private let editor = SampleEvents.window(SampleApps.editor)
    private let browser = SampleEvents.window(SampleApps.browser)

    init() throws {
        store = try RecordingEventStore()
        queue = HeartbeatQueue(store: store)
        try queue.register(bucket)
    }

    private func at(_ offset: Int) -> Int {
        FakeTime.origin + offset
    }

    @Test("consecutive identical heartbeats merge within pulsetime")
    func consecutiveIdenticalHeartbeatsMergeWithinPulsetime() throws {
        queue.record(editor, bucketId: bucket.id, at: at(0))
        queue.record(nil, bucketId: bucket.id, at: at(20))
        queue.record(editor, bucketId: bucket.id, at: at(28))
        queue.record(nil, bucketId: bucket.id, at: at(40))
        queue.flush()

        #expect(try store.events(bucket.id) == [E.event(0, 40, editor)])
    }

    @Test("nothing is written before a flush")
    func nothingIsWrittenBeforeAFlush() throws {
        queue.record(editor, bucketId: bucket.id, at: at(0))
        queue.record(browser, bucketId: bucket.id, at: at(30))

        #expect(store.writes == 0)
        #expect(queue.hasPendingWrites)
        #expect(try store.events(bucket.id).isEmpty)
    }

    @Test("a periodic flush writes one batch every 10 seconds")
    func aPeriodicFlushWritesOneBatchEvery10Seconds() throws {
        let time = FakeTime()
        let recorder = Counter()
        queue.startPeriodicFlush(timers: time) { [recorder] in recorder.count += 1 }
        queue.record(editor, bucketId: bucket.id, at: at(0))

        time.advance(by: 9)
        #expect(store.writes == 0)
        time.advance(by: 1)
        #expect(store.writes == 1)
        time.advance(by: 10)

        #expect(store.writes == 1, "an unchanged queue writes nothing")
        #expect(recorder.count == 2)
        queue.stopPeriodicFlush()
        #expect(time.scheduledIntervals.isEmpty)
    }

    @Test("a failed write is retried by the next flush")
    func aFailedWriteIsRetriedByTheNextFlush() throws {
        queue.record(editor, bucketId: bucket.id, at: at(0))
        queue.record(browser, bucketId: bucket.id, at: at(30))
        store.failing = true
        #expect(queue.flush() == false)

        store.failing = false
        queue.record(nil, bucketId: bucket.id, at: at(45))
        #expect(queue.flush())

        #expect(try store.events(bucket.id) == [E.event(0, 30, editor), E.event(30, 15, browser)])
    }

    @Test("a restart within pulsetime keeps extending the stored event")
    func aRestartWithinPulsetimeKeepsExtendingTheStoredEvent() throws {
        queue.record(editor, bucketId: bucket.id, at: at(0))
        queue.stopAll(at: at(60))
        queue.flush()

        let relaunched = HeartbeatQueue(store: store)
        try relaunched.register(bucket)
        relaunched.record(editor, bucketId: bucket.id, at: at(65))
        relaunched.stopAll(at: at(90))
        relaunched.flush()

        #expect(try store.events(bucket.id) == [E.event(0, 90, editor)])
        #expect(relaunched.latestEnd == at(90))
    }

    @Test("an interruption splits the event around the clock jump")
    func anInterruptionSplitsTheEventAroundTheClockJump() throws {
        queue.record(editor, bucketId: bucket.id, at: at(0))
        queue.interrupt(from: at(30), to: at(3_630))
        queue.record(editor, bucketId: bucket.id, at: at(3_640))
        queue.flush()

        #expect(try store.events(bucket.id) == [E.event(0, 30, editor), E.event(3_630, 10, editor)])
    }

    @MainActor
    final class Counter {
        var count = 0
    }
}
