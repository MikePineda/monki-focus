// SPDX-License-Identifier: AGPL-3.0-or-later

/// A stretch of seconds at a category level, as the pulse weighs it.
public struct PulseInput: Hashable, Sendable, Codable {
    public var seconds: Int
    public var level: Int

    public init(seconds: Int, level: Int) {
        self.seconds = seconds
        self.level = level
    }

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case seconds, level
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        seconds = try container.decode(Int.self, forKey: .seconds)
        level = try container.decode(Int.self, forKey: .level)
    }
}

/// The focus pulse (SEMANTICS.md §10.5): `round(Σ(seconds × level) / Σ seconds)`
/// rounded half up, identical to RescueTime's `Σ(s × k) / (Σ s × 4) × 100`
/// with `k = level / 25`. Nil without tracked time. Integer arithmetic only,
/// so every platform rounds identically.
public func pulse(_ entries: [PulseInput]) -> Int? {
    var total = 0
    var weighted = 0
    for entry in entries {
        total += entry.seconds
        weighted += entry.seconds * entry.level
    }
    guard total != 0 else { return nil }
    // Half up: floor(weighted / total + 1/2) without floating point.
    return floorDivision(weighted * 2 + total, total * 2)
}
