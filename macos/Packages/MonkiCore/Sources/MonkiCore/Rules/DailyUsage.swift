// SPDX-License-Identifier: AGPL-3.0-or-later

/// Active seconds spent today per budgeted rule. Ignored when `localDate` is
/// not today's local date in a pinned zone. Rule ids are plain dictionary
/// keys, so no id can reach anything but its own entry (SEMANTICS.md §14).
public struct DailyUsage: Hashable, Sendable, Codable {
    public var localDate: String
    public var secondsByRule: [String: Int]

    public init(localDate: String, secondsByRule: [String: Int]) {
        self.localDate = localDate
        self.secondsByRule = secondsByRule
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case localDate, secondsByRule
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        localDate = try container.decode(String.self, forKey: .localDate)
        secondsByRule = try container.decode([String: Int].self, forKey: .secondsByRule)
    }
}
