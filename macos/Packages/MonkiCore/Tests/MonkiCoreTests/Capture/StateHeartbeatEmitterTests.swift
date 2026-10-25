// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import Testing

@Suite("state heartbeat emitter")
struct StateHeartbeatEmitterTests {
    private typealias S = CaptureSamples

    /// Feeds `observations` (offset, data) through an emitter and a buffer.
    private func events(_ observations: [(Int, EventData?)], pulsetime: Int = 10) throws -> [ActivityEvent] {
        var emitter = StateHeartbeatEmitter()
        var buffer = try HeartbeatBuffer(pulsetime: pulsetime)
        for (offset, data) in observations {
            for heartbeat in emitter.observe(data, at: S.origin + offset) {
                try buffer.heartbeat(heartbeat)
            }
        }
        var ledger = EventLedger()
        ledger.apply(buffer.drain())
        return ledger.events
    }

    @Test("a state observed again keeps one event growing whatever the pulsetime")
    func aStateObservedAgainKeepsOneEventGrowingWhateverThePulsetime() throws {
        let result = try events([(0, S.editor), (300, S.editor), (900, S.editor)], pulsetime: 10)

        #expect(result == [S.event(0, 900, S.editor)])
    }

    @Test("a change closes the old state where the new one starts")
    func aChangeClosesTheOldStateWhereTheNewOneStarts() throws {
        let result = try events([(0, S.editor), (40, S.browser), (55, S.terminal), (60, nil)])

        #expect(result == [S.event(0, 40, S.editor), S.event(40, 15, S.browser), S.event(55, 5, S.terminal)])
    }

    @Test("a stop closes the event at the stop and leaves a gap until capture resumes")
    func aStopClosesTheEventAtTheStopAndLeavesAGapUntilCaptureResumes() throws {
        let result = try events([(0, S.editor), (30, nil), (100, S.editor), (110, nil)])

        #expect(result == [S.event(0, 30, S.editor), S.event(100, 10, S.editor)])
    }

    @Test("resuming the same state within pulsetime extends the stopped event")
    func resumingTheSameStateWithinPulsetimeExtendsTheStoppedEvent() throws {
        let result = try events([(0, S.editor), (30, nil), (38, S.editor), (50, nil)])

        #expect(result == [S.event(0, 50, S.editor)])
    }

    @Test("an observation earlier than the previous one is moved to it")
    func anObservationEarlierThanThePreviousOneIsMovedToIt() throws {
        let result = try events([(0, S.editor), (20, S.editor), (15, S.browser), (30, nil)])

        #expect(result == [S.event(0, 20, S.editor), S.event(20, 10, S.browser)])
    }

    @Test("an interruption closes the state at the stop and reopens it at the resume")
    func anInterruptionClosesTheStateAtTheStopAndReopensItAtTheResume() throws {
        var emitter = StateHeartbeatEmitter()
        var buffer = try HeartbeatBuffer(pulsetime: 10)
        let heartbeats =
            emitter.observe(S.editor, at: S.origin) + emitter.interrupt(from: S.origin + 20, to: S.origin + 3_600)
            + emitter.observe(nil, at: S.origin + 3_605)
        for heartbeat in heartbeats {
            try buffer.heartbeat(heartbeat)
        }

        #expect(buffer.drain() == [S.event(0, 20, S.editor), S.event(3_600, 5, S.editor)])
        #expect(emitter.current == nil)
    }
}
