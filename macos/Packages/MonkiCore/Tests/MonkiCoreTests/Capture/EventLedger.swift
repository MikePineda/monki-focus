// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// An in-memory stand-in for the event table: batches are upserted on the
/// event start, exactly as the GRDB store does.
struct EventLedger {
    private var rows: [Int: ActivityEvent] = [:]

    init(_ seed: [ActivityEvent] = []) {
        for event in seed {
            rows[Self.start(event)] = event
        }
    }

    mutating func apply(_ batch: [ActivityEvent]) {
        for event in batch {
            rows[Self.start(event)] = event
        }
    }

    var events: [ActivityEvent] {
        rows.sorted { $0.key < $1.key }.map(\.value)
    }

    static func start(_ event: ActivityEvent) -> Int {
        (try? epochSecondsOf(event.timestamp)) ?? .min
    }
}

/// Synthetic capture data shared by the capture tests.
enum CaptureSamples {
    /// 2026-10-26T00:00:00Z.
    static let origin = 1_792_972_800

    static let editor = EventData.window(WindowData(app: "org.example.Editor"))
    static let browser = EventData.window(WindowData(app: "org.example.Browser"))
    static let terminal = EventData.window(WindowData(app: "org.example.Terminal"))

    static func event(_ offset: Int, _ duration: Int, _ data: EventData) -> ActivityEvent {
        ActivityEvent(timestamp: utcInstantOf(origin + offset), duration: duration, data: data)
    }
}
