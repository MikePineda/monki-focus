// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiCoreTesting

/// One step of a random capture stream: a state observed at an offset from
/// the origin (nil: capture stopped), optionally followed by a flush.
struct CaptureStep {
    var offset: Int
    var data: EventData?
    var flushAfter: Bool
}

/// Random capture streams: a few window states and stops, steps from zero
/// seconds to over an hour (far beyond any pulsetime, as a throttled timer
/// would give), and the occasional observation slightly in the past.
struct CaptureGenerator {
    static let states: [EventData?] = [
        CaptureSamples.editor, CaptureSamples.browser, CaptureSamples.terminal, nil,
    ]

    var random: SeededGenerator

    init(seed: UInt64) {
        random = SeededGenerator(seed: seed)
    }

    mutating func int(_ range: ClosedRange<Int>) -> Int {
        Int.random(in: range, using: &random)
    }

    mutating func step() -> Int {
        switch int(0...9) {
        case 0: 0
        case 1: -int(1...5)
        case 2: int(11...4_000)
        default: int(1...10)
        }
    }

    mutating func stream(maxCount: Int = 60) -> [CaptureStep] {
        var offset = 0
        return (0..<int(1...maxCount)).map { _ in
            offset = max(0, offset + step())
            return CaptureStep(
                offset: offset,
                data: Self.states[int(0...Self.states.count - 1)],
                flushAfter: int(0...3) == 0
            )
        }
    }

    /// Raw ActivityWatch heartbeats with strictly increasing starts and no duration.
    mutating func heartbeats(maxCount: Int = 60) -> [ActivityEvent] {
        var offset = 0
        return (0..<int(0...maxCount)).map { _ in
            offset += int(1...30)
            let data = Self.states[int(0...2)] ?? CaptureSamples.editor
            return CaptureSamples.event(offset, 0, data)
        }
    }
}
