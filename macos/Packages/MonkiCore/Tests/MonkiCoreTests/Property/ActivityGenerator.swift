// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import MonkiCoreTesting

/// Synthetic analytics inputs (generic domains, app ids and categories), the
/// Swift twin of the arbitraries in
/// `packages/analytics/tests/properties/BlockProperties.test.ts`.
struct ActivityGenerator {
    /// 2026-10-26T00:00:00Z.
    static let start = 1_792_972_800
    static let levels = [0, 25, 50, 75, 100]
    static let activityKeys = ["example.org", "docs.example.org", "org.example.Editor", "example.net"]
    static let categories = ["reference", "social", "video/short-form", "uncategorised"]
    static let devices = ["device-a", "device-b", "device-c"]

    var random: SeededGenerator

    init(seed: UInt64) {
        random = SeededGenerator(seed: seed)
    }

    mutating func pick<T>(_ options: [T]) -> T {
        options[Int.random(in: 0..<options.count, using: &random)]
    }

    mutating func int(_ range: ClosedRange<Int>) -> Int {
        Int.random(in: range, using: &random)
    }

    mutating func attributed(at timestamp: Int, duration: Int) -> AttributedEvent {
        AttributedEvent(
            timestamp: utcInstantOf(timestamp),
            duration: duration,
            source: pick(ActivitySource.allCases),
            activityKey: pick(Self.activityKeys),
            categoryPath: pick(Self.categories),
            level: pick(Self.levels)
        )
    }

    /// Events anywhere in one day, overlapping freely.
    mutating func overlappingEvents(maxCount: Int = 40) -> [AttributedEvent] {
        (0..<int(0...maxCount)).map { _ in attributed(at: Self.start + int(0...86_400), duration: int(0...3_600)) }
    }

    /// Back-to-back events separated by gaps, so no block can exceed 300 s.
    mutating func sequentialEvents() -> [AttributedEvent] {
        var cursor = Self.start
        return (0..<int(0...40)).map { _ in
            cursor += int(0...900)
            let event = attributed(at: cursor, duration: int(0...2_000))
            cursor += event.duration
            return event
        }
    }

    mutating func pulseEntries() -> [PulseInput] {
        (0..<int(0...500)).map { _ in PulseInput(seconds: int(0...31_622_400), level: pick(Self.levels)) }
    }

    /// A title marked with U+0001 and a URL (query and fragment included) marked with U+0002.
    mutating func withSecrets(_ event: AttributedEvent) -> AttributedEvent {
        var marked = event
        let word = String((0..<int(1...40)).map { _ in pick(Array("abcXYZ 09/?#&=:.\u{00e9}\u{4e2d}")) })
        marked.title = "\u{0001}\(word)"
        marked.url = "https://\(pick(Self.activityKeys))/\(word)?q=\(int(0...999))#\u{0002}"
        return marked
    }
}
