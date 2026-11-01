// SPDX-License-Identifier: AGPL-3.0-or-later

/// A softer weekend chosen by the user (`ruleset.schema.json#/$defs/relaxedWeekends`,
/// SEMANTICS.md §6.4): bedtime windows that start on a Friday or Saturday ask
/// for an intention instead of blocking, and on Saturdays and Sundays `block`
/// and `hide-feed` rules on short-video surfaces ask for one too. Absent from a
/// rule set means off.
public struct RelaxedWeekends: Hashable, Sendable, Codable {
    public var enabled: Bool

    public init(enabled: Bool) {
        self.enabled = enabled
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case enabled
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        enabled = try container.decode(Bool.self, forKey: .enabled)
    }
}
