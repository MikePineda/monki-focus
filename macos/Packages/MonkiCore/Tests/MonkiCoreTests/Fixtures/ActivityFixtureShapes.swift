// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore

// The `given` shapes of the `activity` fixture operations
// (`schema/v1/activity-fixture.schema.json`). `then` is compared as JSON.

/// An activity fixture with its `given` decoded as `Given`.
struct ActivityFixture<Given: Decodable>: Decodable {
    let id: String
    let kind: String
    let operation: String
    let description: String
    let given: Given
}

struct HeartbeatMergeGiven: Decodable {
    let pulsetime: Int
    let events: [ActivityEvent]
    let heartbeats: [ActivityEvent]
}

struct ActiveTimeGiven: Decodable {
    let events: [ActivityEvent]
    let afk: [ActivityEvent]
}

struct CategoriseGiven: Decodable {
    let activity: CategorisableActivity
    let assignments: [CategoryAssignment]
    let includeDefaults: Bool
}

struct PulseGiven: Decodable {
    let entries: [PulseInput]
}

struct BlocksGiven: Decodable {
    let deviceId: String
    let syncActivityKey: Bool
    let events: [AttributedEvent]
}

struct DailyTotalsGiven: Decodable {
    let timeZone: String
    let entries: [LevelledInterval]
}

struct CrossDeviceCapGiven: Decodable {
    let blocks: [SyncBlock]
}
