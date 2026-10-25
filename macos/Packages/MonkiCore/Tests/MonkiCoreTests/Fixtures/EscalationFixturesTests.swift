// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

/// SEMANTICS.md §7: every `escalation` fixture, each step fed the previous state.
@Suite("escalation fixtures")
struct EscalationFixturesTests {
    @Test("escalation", arguments: try FixtureLoader.load("escalation"))
    func escalation(_ fixture: Fixture) throws {
        let parsed = try fixture.decode(EscalationFixture.self)
        var state = parsed.given.state
        for (index, step) in parsed.steps.enumerated() {
            let result = try nextEscalation(
                state, event: step.event, now: step.at, guardianLinked: parsed.given.guardianLinked)
            #expect(result == step.then, "step \(index) (\(step.event.type) at \(step.at))")
            state = result.state
        }
    }
}
