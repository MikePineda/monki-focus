// SPDX-License-Identifier: AGPL-3.0-or-later

/// The run-time inputs of `decide` besides the rule set and the clock
/// (`decision-context.schema.json#/$defs/state`).
public struct DecisionState: Hashable, Sendable, Codable {
    /// At most one state per target group; a missing group is the initial idle state.
    public var escalation: [EscalationState]
    public var usage: DailyUsage?
    public var unlocks: [VerifiedUnlock]
    public var guardianLinked: Bool
    /// `effectiveFrom` of a waiting rule change: `validUntil` never passes it (§5.6).
    public var pendingEffectiveFrom: String?

    public init(
        escalation: [EscalationState] = [],
        usage: DailyUsage? = nil,
        unlocks: [VerifiedUnlock] = [],
        guardianLinked: Bool = false,
        pendingEffectiveFrom: String? = nil
    ) {
        self.escalation = escalation
        self.usage = usage
        self.unlocks = unlocks
        self.guardianLinked = guardianLinked
        self.pendingEffectiveFrom = pendingEffectiveFrom
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case escalation, usage, unlocks, guardianLinked, pendingEffectiveFrom
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        escalation = try container.decode([EscalationState].self, forKey: .escalation)
        usage = try container.decodeNullable(DailyUsage.self, forKey: .usage)
        unlocks = try container.decode([VerifiedUnlock].self, forKey: .unlocks)
        guardianLinked = try container.decode(Bool.self, forKey: .guardianLinked)
        pendingEffectiveFrom = try container.decodeIfPresent(String.self, forKey: .pendingEffectiveFrom)
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(escalation, forKey: .escalation)
        try container.encode(usage, forKey: .usage)
        try container.encode(unlocks, forKey: .unlocks)
        try container.encode(guardianLinked, forKey: .guardianLinked)
        try container.encodeIfPresent(pendingEffectiveFrom, forKey: .pendingEffectiveFrom)
    }
}
