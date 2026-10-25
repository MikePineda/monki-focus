// SPDX-License-Identifier: AGPL-3.0-or-later

/// One rule of a rule set (`rule.schema.json`). Empty `schedules` means
/// always active; hide-feed rules take no budget.
public struct Rule: Hashable, Sendable, Codable {
    public var id: String
    public var target: Target
    public var mode: RuleMode
    public var schedules: [RuleSchedule]
    public var dailyBudgetMinutes: Int?
    public var enabled: Bool
    public var note: String?

    public init(
        id: String,
        target: Target,
        mode: RuleMode,
        schedules: [RuleSchedule] = [],
        dailyBudgetMinutes: Int? = nil,
        enabled: Bool = true,
        note: String? = nil
    ) {
        self.id = id
        self.target = target
        self.mode = mode
        self.schedules = schedules
        self.dailyBudgetMinutes = dailyBudgetMinutes
        self.enabled = enabled
        self.note = note
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case id, target, mode, schedules, dailyBudgetMinutes, enabled, note
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        target = try container.decode(Target.self, forKey: .target)
        mode = try container.decode(RuleMode.self, forKey: .mode)
        schedules = try container.decode([RuleSchedule].self, forKey: .schedules)
        dailyBudgetMinutes = try container.decodeIfPresent(Int.self, forKey: .dailyBudgetMinutes)
        enabled = try container.decode(Bool.self, forKey: .enabled)
        note = try container.decodeIfPresent(String.self, forKey: .note)
    }
}
