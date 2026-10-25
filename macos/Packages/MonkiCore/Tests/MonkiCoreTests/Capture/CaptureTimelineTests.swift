// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import MonkiCoreTesting
import Testing

@Suite("capture timeline")
struct CaptureTimelineTests {
    private static let origin = CaptureSamples.origin

    private let wall = FixedClock(Date(timeIntervalSince1970: TimeInterval(origin)))
    private let monotonic = FakeMonotonicClock(start: .seconds(1_000))

    private func advance(_ seconds: Int) {
        wall.advance(by: TimeInterval(seconds))
        monotonic.advance(by: .seconds(seconds))
    }

    @Test("it follows the wall clock while both clocks agree")
    func itFollowsTheWallClockWhileBothClocksAgree() {
        var timeline = CaptureTimeline()

        let first = timeline.read(wall: wall.now(), monotonic: monotonic.elapsed())
        advance(42)
        let second = timeline.read(wall: wall.now(), monotonic: monotonic.elapsed())

        #expect(first == CaptureReading(instant: Self.origin))
        #expect(second == CaptureReading(instant: Self.origin + 42))
    }

    @Test("a wall clock set back keeps counting monotonic time")
    func aWallClockSetBackKeepsCountingMonotonicTime() {
        var timeline = CaptureTimeline()
        _ = timeline.read(wall: wall.now(), monotonic: monotonic.elapsed())
        advance(60)
        wall.advance(by: -3_600)

        let reading = timeline.read(wall: wall.now(), monotonic: monotonic.elapsed())

        #expect(reading == CaptureReading(instant: Self.origin + 60))
    }

    @Test("a wall clock jump forward is reported as an interruption")
    func aWallClockJumpForwardIsReportedAsAnInterruption() {
        var timeline = CaptureTimeline()
        _ = timeline.read(wall: wall.now(), monotonic: monotonic.elapsed())
        advance(10)
        wall.advance(by: 7_200)

        let reading = timeline.read(wall: wall.now(), monotonic: monotonic.elapsed())

        #expect(reading == CaptureReading(instant: Self.origin + 7_210, interruptedAt: Self.origin + 10))
    }

    @Test("small drift within the tolerance never goes backwards")
    func smallDriftWithinTheToleranceNeverGoesBackwards() {
        var timeline = CaptureTimeline()
        _ = timeline.read(wall: wall.now(), monotonic: monotonic.elapsed())
        advance(5)
        _ = timeline.read(wall: wall.now(), monotonic: monotonic.elapsed())
        wall.advance(by: -1)

        let reading = timeline.read(wall: wall.now(), monotonic: monotonic.elapsed())

        #expect(reading == CaptureReading(instant: Self.origin + 5))
    }

    @Test("a relaunch never reads earlier than the latest stored event")
    func aRelaunchNeverReadsEarlierThanTheLatestStoredEvent() {
        var timeline = CaptureTimeline(floor: Self.origin + 500)

        let reading = timeline.read(wall: wall.now(), monotonic: monotonic.elapsed())

        #expect(reading.instant == Self.origin + 500)
    }
}
