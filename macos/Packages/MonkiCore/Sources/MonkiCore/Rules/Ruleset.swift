// SPDX-License-Identifier: AGPL-3.0-or-later

/// A user's rule set (`ruleset.schema.json`). `timeZone` pins the zone every
/// schedule, bedtime and budget day is evaluated in; `pendingTimeZone` is set
/// only while a zone change waits (both zones apply, the stricter wins).
public struct Ruleset: Hashable, Sendable, Codable {
    public var schemaVersion: Int
    public var revision: Int
    public var updatedAt: String
    public var timeZone: String
    public var pendingTimeZone: String?
    public var rules: [Rule]
    public var categories: [CategoryAssignment]
    public var bedtime: Bedtime
    public var workHours: Schedule

    public init(
        schemaVersion: Int = 1,
        revision: Int,
        updatedAt: String,
        timeZone: String,
        pendingTimeZone: String? = nil,
        rules: [Rule],
        categories: [CategoryAssignment],
        bedtime: Bedtime,
        workHours: Schedule
    ) {
        self.schemaVersion = schemaVersion
        self.revision = revision
        self.updatedAt = updatedAt
        self.timeZone = timeZone
        self.pendingTimeZone = pendingTimeZone
        self.rules = rules
        self.categories = categories
        self.bedtime = bedtime
        self.workHours = workHours
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case schemaVersion, revision, updatedAt, timeZone, pendingTimeZone, rules, categories, bedtime, workHours
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        schemaVersion = try container.decode(Int.self, forKey: .schemaVersion)
        revision = try container.decode(Int.self, forKey: .revision)
        updatedAt = try container.decode(String.self, forKey: .updatedAt)
        timeZone = try container.decode(String.self, forKey: .timeZone)
        pendingTimeZone = try container.decodeIfPresent(String.self, forKey: .pendingTimeZone)
        rules = try container.decode([Rule].self, forKey: .rules)
        categories = try container.decode([CategoryAssignment].self, forKey: .categories)
        bedtime = try container.decode(Bedtime.self, forKey: .bedtime)
        workHours = try container.decode(Schedule.self, forKey: .workHours)
    }
}
