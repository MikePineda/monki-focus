// SPDX-License-Identifier: AGPL-3.0-or-later

/// The intention gate a friction restriction shows (`decision.schema.json#/$defs/gate`).
public struct Gate: Hashable, Sendable, Codable {
    public var level: Int
    public var pauseSeconds: Int
    public var frictionType: FrictionType
    public var requiresTypedIntention: Bool
    public var requiresGuardianKey: Bool

    public init(
        level: Int,
        pauseSeconds: Int,
        frictionType: FrictionType,
        requiresTypedIntention: Bool,
        requiresGuardianKey: Bool
    ) {
        self.level = level
        self.pauseSeconds = pauseSeconds
        self.frictionType = frictionType
        self.requiresTypedIntention = requiresTypedIntention
        self.requiresGuardianKey = requiresGuardianKey
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case level, pauseSeconds, frictionType, requiresTypedIntention, requiresGuardianKey
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        level = try container.decode(Int.self, forKey: .level)
        pauseSeconds = try container.decode(Int.self, forKey: .pauseSeconds)
        frictionType = try container.decode(FrictionType.self, forKey: .frictionType)
        requiresTypedIntention = try container.decode(Bool.self, forKey: .requiresTypedIntention)
        requiresGuardianKey = try container.decode(Bool.self, forKey: .requiresGuardianKey)
    }
}
