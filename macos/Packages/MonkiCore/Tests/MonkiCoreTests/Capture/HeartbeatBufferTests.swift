// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

@Suite("heartbeat buffer")
struct HeartbeatBufferTests {
    private typealias S = CaptureSamples

    private func merged(_ heartbeats: [ActivityEvent], pulsetime: Int = 10) throws -> [ActivityEvent] {
        var buffer = try HeartbeatBuffer(pulsetime: pulsetime)
        var ledger = EventLedger()
        for heartbeat in heartbeats {
            try buffer.heartbeat(heartbeat)
        }
        ledger.apply(buffer.drain())
        return ledger.events
    }

    @Test("consecutive identical heartbeats merge within pulsetime")
    func consecutiveIdenticalHeartbeatsMergeWithinPulsetime() throws {
        let events = try merged([S.event(0, 0, S.editor), S.event(5, 0, S.editor), S.event(15, 0, S.editor)])

        #expect(events == [S.event(0, 15, S.editor)])
    }

    @Test("an identical heartbeat beyond pulsetime opens a new event")
    func anIdenticalHeartbeatBeyondPulsetimeOpensANewEvent() throws {
        let events = try merged([S.event(0, 5, S.editor), S.event(16, 0, S.editor)])

        #expect(events == [S.event(0, 5, S.editor), S.event(16, 0, S.editor)])
    }

    @Test("a heartbeat with different data opens a new event")
    func aHeartbeatWithDifferentDataOpensANewEvent() throws {
        let events = try merged([S.event(0, 5, S.editor), S.event(5, 0, S.browser)])

        #expect(events == [S.event(0, 5, S.editor), S.event(5, 0, S.browser)])
    }

    @Test("a heartbeat that starts before the last event ends never overlaps it")
    func aHeartbeatThatStartsBeforeTheLastEventEndsNeverOverlapsIt() throws {
        let events = try merged([S.event(0, 30, S.editor), S.event(20, 15, S.browser)])

        #expect(events == [S.event(0, 30, S.editor), S.event(30, 5, S.browser)])
    }

    @Test("a heartbeat that starts before the last event extends it instead of overlapping")
    func aHeartbeatThatStartsBeforeTheLastEventExtendsItInsteadOfOverlapping() throws {
        let events = try merged([S.event(10, 5, S.editor), S.event(2, 20, S.editor)])

        #expect(events == [S.event(10, 12, S.editor)])
    }

    @Test("a zero-length event is replaced by a new event at the same start")
    func aZeroLengthEventIsReplacedByANewEventAtTheSameStart() throws {
        let events = try merged([S.event(0, 5, S.editor), S.event(5, 0, S.browser), S.event(5, 0, S.terminal)])

        #expect(events == [S.event(0, 5, S.editor), S.event(5, 0, S.terminal)])
    }

    @Test("drain returns each changed event once, in start order")
    func drainReturnsEachChangedEventOnceInStartOrder() throws {
        var buffer = try HeartbeatBuffer(pulsetime: 10)
        try buffer.heartbeat(S.event(0, 0, S.editor))
        try buffer.heartbeat(S.event(4, 0, S.editor))
        try buffer.heartbeat(S.event(4, 0, S.browser))
        try buffer.heartbeat(S.event(9, 0, S.browser))

        #expect(buffer.drain() == [S.event(0, 4, S.editor), S.event(4, 5, S.browser)])
        #expect(buffer.hasPendingWrites == false)
        #expect(buffer.drain().isEmpty)
    }

    @Test("a seeded last event keeps growing after a restart within pulsetime")
    func aSeededLastEventKeepsGrowingAfterARestartWithinPulsetime() throws {
        var buffer = try HeartbeatBuffer(pulsetime: 10, last: S.event(0, 30, S.editor))

        try buffer.heartbeat(S.event(38, 0, S.editor))

        #expect(buffer.drain() == [S.event(0, 38, S.editor)])
        #expect(buffer.lastEnd == S.origin + 38)
    }

    @Test("a requeued batch keeps the newer state of an event changed since the drain")
    func aRequeuedBatchKeepsTheNewerStateOfAnEventChangedSinceTheDrain() throws {
        var buffer = try HeartbeatBuffer(pulsetime: 10)
        try buffer.heartbeat(S.event(0, 5, S.editor))
        try buffer.heartbeat(S.event(5, 0, S.browser))
        let failed = buffer.drain()
        try buffer.heartbeat(S.event(8, 0, S.browser))

        try buffer.requeue(failed)

        #expect(buffer.drain() == [S.event(0, 5, S.editor), S.event(5, 3, S.browser)])
    }

    @Test("heartbeat-merge fixtures give the shared events", arguments: try FixtureLoader.load("activity"))
    func heartbeatMergeFixturesGiveTheSharedEvents(_ fixture: Fixture) throws {
        let json = try StrictJSONParser.parse(fixture.data)
        guard json["operation"]?.stringValue == "heartbeat-merge" else { return }
        let given = try fixture.decode(ActivityFixture<HeartbeatMergeGiven>.self).given
        let expected = try #require(json["then"]?["events"])

        var buffer = try HeartbeatBuffer(pulsetime: given.pulsetime, last: given.events.last)
        var ledger = EventLedger(given.events)
        for heartbeat in given.heartbeats {
            try buffer.heartbeat(heartbeat)
        }
        ledger.apply(buffer.drain())

        #expect(try StrictJSONParser.parse(JSONEncoder().encode(ledger.events)) == expected)
    }
}
