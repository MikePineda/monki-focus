// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

/// Analytics invariants over seeded random inputs (`ActivityGenerator`); a
/// failure names its seed, which reproduces the case.
@Suite("activity properties")
struct ActivityPropertiesTests {
    private static let runs: [UInt64] = Array(1...300)

    private func secondsPerStart(_ blocks: [SyncBlock]) -> [String: Int] {
        blocks.reduce(into: [:]) { $0[$1.blockStart, default: 0] += $1.seconds }
    }

    @Test("split preserves total seconds", arguments: runs)
    func splitPreservesTotalSeconds(seed: UInt64) throws {
        var generator = ActivityGenerator(seed: seed)
        let events = generator.sequentialEvents()
        let syncActivityKey = generator.pick([true, false])

        let blocks = try toBlocks(events, options: BlockOptions(deviceId: "device-a", syncActivityKey: syncActivityKey))

        #expect(blocks.reduce(0) { $0 + $1.seconds } == events.reduce(0) { $0 + $1.duration }, "seed \(seed)")
    }

    @Test("block never exceeds 300 seconds", arguments: runs)
    func blockNeverExceeds300Seconds(seed: UInt64) throws {
        var generator = ActivityGenerator(seed: seed)

        let blocks = try toBlocks(
            generator.overlappingEvents(), options: BlockOptions(deviceId: "device-a", syncActivityKey: true))

        #expect(blocks.allSatisfy { (1...300).contains($0.seconds) }, "seed \(seed)")
        #expect(secondsPerStart(blocks).values.allSatisfy { $0 <= 300 }, "seed \(seed)")
    }

    @Test("cross-device cap keeps min of total and 300 per block start", arguments: runs)
    func crossDeviceCapKeepsMinOfTotalAnd300PerBlockStart(seed: UInt64) throws {
        var generator = ActivityGenerator(seed: seed)
        var blocks: [SyncBlock] = []
        for _ in 0..<generator.int(0...4) {
            let options = BlockOptions(deviceId: generator.pick(ActivityGenerator.devices), syncActivityKey: true)
            blocks += try toBlocks(generator.overlappingEvents(maxCount: 10), options: options)
        }

        let before = secondsPerStart(blocks)
        let after = secondsPerStart(try capAcrossDevices(blocks))

        for (blockStart, seconds) in before {
            #expect(after[blockStart] == min(seconds, 300), "seed \(seed) at \(blockStart)")
        }
        #expect(Set(after.keys) == Set(before.keys), "seed \(seed)")
    }

    @Test("pulse is between 0 and 100 or nil", arguments: runs)
    func pulseIsBetween0And100OrNil(seed: UInt64) {
        var generator = ActivityGenerator(seed: seed)
        let entries = generator.pulseEntries()

        let value = pulse(entries)

        if entries.reduce(0, { $0 + $1.seconds }) == 0 {
            #expect(value == nil, "seed \(seed)")
        } else {
            #expect(value.map { (0...100).contains($0) } == true, "seed \(seed)")
        }
    }

    @Test("synced blocks never contain titles or URLs", arguments: runs)
    func syncedBlocksNeverContainTitlesOrUrls(seed: UInt64) throws {
        var generator = ActivityGenerator(seed: seed)
        let events = generator.overlappingEvents(maxCount: 20).map { generator.withSecrets($0) }
        let syncActivityKey = generator.pick([true, false])

        let blocks = try toBlocks(events, options: BlockOptions(deviceId: "device-a", syncActivityKey: syncActivityKey))
        let serialised = try String(decoding: JSONEncoder().encode(blocks), as: UTF8.self)

        for block in blocks {
            let keys = try StrictJSONParser.parse(JSONEncoder().encode(block))
            guard case .object(let members) = keys else { throw CocoaError(.coderInvalidValue) }
            #expect(members.keys.sorted() == SyncBlock.fields.sorted(), "seed \(seed)")
            if let key = block.activityKey { #expect(ActivityGenerator.activityKeys.contains(key), "seed \(seed)") }
        }
        // Every title carries U+0001 and every URL U+0002: neither reaches a block.
        #expect(!serialised.contains("\\u0001") && !serialised.contains("\u{0001}"), "seed \(seed)")
        #expect(!serialised.contains("\\u0002") && !serialised.contains("\u{0002}"), "seed \(seed)")
        #expect(!serialised.contains("://") && !serialised.contains(":\\/\\/"), "seed \(seed)")
    }
}
