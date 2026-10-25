// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

/// SEMANTICS.md §6: `isScheduleActive` or `bedtimePhase` against every `schedule` fixture.
@Suite("schedule fixtures")
struct ScheduleFixturesTests {
    @Test("schedule", arguments: try FixtureLoader.load("schedule"))
    func schedule(_ fixture: Fixture) throws {
        let parsed = try fixture.decode(ScheduleFixture.self)
        let given = parsed.given
        if let bedtime = given.bedtime {
            let phase = try bedtimePhase(bedtime, now: given.now, timeZone: given.timeZone)
            #expect(phase == parsed.then.phase)
        } else {
            let schedules = try #require(given.schedules)
            let workHours = try #require(given.workHours)
            let active = try isScheduleActive(schedules, workHours: workHours, now: given.now, timeZone: given.timeZone)
            #expect(active == parsed.then.active)
        }
    }
}
