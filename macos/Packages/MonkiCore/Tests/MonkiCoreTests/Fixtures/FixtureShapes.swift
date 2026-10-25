// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore

// The shapes of the fixture kinds (`schema/v1/*-fixture.schema.json`),
// decoded strictly like the models: an unknown key fails the runner.

struct DecisionFixture: Decodable {
    struct Given: Decodable {
        let ruleset: Ruleset
        let now: String
        let state: DecisionState
    }

    struct When: Decodable {
        let target: Observation
    }

    let id: String
    let kind: String
    let description: String
    let given: Given
    let when: When
    let then: Decision
}

struct CandidatesFixture: Decodable {
    struct Given: Decodable {
        let ruleset: Ruleset
        let now: String
    }

    struct When: Decodable {
        let target: Observation
    }

    struct Then: Decodable, Equatable {
        let frictionCandidates: [String]
        let budgetedRules: [String]
    }

    let id: String
    let kind: String
    let description: String
    let given: Given
    let when: When
    let then: Then
}

struct UrlNormalizeFixture: Decodable {
    struct Given: Decodable {
        let urlText: String
    }

    let id: String
    let kind: String
    let description: String
    let given: Given
    let then: UrlNormalization
}

struct ScheduleFixture: Decodable {
    struct Given: Decodable {
        let schedules: [RuleSchedule]?
        let workHours: Schedule?
        let bedtime: Bedtime?
        let now: String
        let timeZone: String
    }

    struct Then: Decodable {
        let active: Bool?
        let phase: BedtimePhase?
    }

    let id: String
    let kind: String
    let description: String
    let given: Given
    let then: Then
}

struct EscalationFixture: Decodable {
    struct Given: Decodable {
        let state: EscalationState
        let guardianLinked: Bool
    }

    struct Step: Decodable {
        let at: String
        let event: EscalationEvent
        let then: EscalationResult
    }

    let id: String
    let kind: String
    let description: String
    let given: Given
    let steps: [Step]
}

struct RuleChangeFixture: Decodable {
    struct Given: Decodable {
        let old: Ruleset
        let new: Ruleset
        let now: String
        let pendingEffectiveFrom: String?
    }

    struct Then: Decodable {
        let effectiveToday: Ruleset
        let effectiveFrom: String?
    }

    let id: String
    let kind: String
    let description: String
    let given: Given
    let then: Then
}

struct InvalidFixture: Decodable {
    struct Then: Decodable {
        let rejected: Bool
        let code: RejectionCode
    }

    let id: String
    let kind: String
    let description: String
    let schema: String
    let then: Then
}
