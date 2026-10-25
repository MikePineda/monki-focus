// SPDX-License-Identifier: AGPL-3.0-or-later

/// The escalation state of one target group (`escalation.schema.json#/$defs/state`).
/// Every field is always present; unused ones are `null`. Instants are UTC
/// RFC 3339 text, as the engine writes them.
public struct EscalationState: Hashable, Sendable, Codable {
    public var targetGroup: String
    public var phase: EscalationPhase
    public var attemptCount: Int
    public var lastAttemptAt: String?
    public var lastActivityAt: String?
    public var brokenCount: Int
    public var lastFrictionType: FrictionType?
    public var gate: Gate?
    public var pauseEndsAt: String?
    public var pendingExtension: Bool
    public var intentionExpiresAt: String?
    public var overrideReadyAt: String?
    public var overrideEndsAt: String?

    public init(
        targetGroup: String,
        phase: EscalationPhase,
        attemptCount: Int,
        lastAttemptAt: String?,
        lastActivityAt: String?,
        brokenCount: Int,
        lastFrictionType: FrictionType?,
        gate: Gate?,
        pauseEndsAt: String?,
        pendingExtension: Bool,
        intentionExpiresAt: String?,
        overrideReadyAt: String?,
        overrideEndsAt: String?
    ) {
        self.targetGroup = targetGroup
        self.phase = phase
        self.attemptCount = attemptCount
        self.lastAttemptAt = lastAttemptAt
        self.lastActivityAt = lastActivityAt
        self.brokenCount = brokenCount
        self.lastFrictionType = lastFrictionType
        self.gate = gate
        self.pauseEndsAt = pauseEndsAt
        self.pendingExtension = pendingExtension
        self.intentionExpiresAt = intentionExpiresAt
        self.overrideReadyAt = overrideReadyAt
        self.overrideEndsAt = overrideEndsAt
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case targetGroup, phase, attemptCount, lastAttemptAt, lastActivityAt, brokenCount, lastFrictionType, gate
        case pauseEndsAt, pendingExtension, intentionExpiresAt, overrideReadyAt, overrideEndsAt
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        targetGroup = try container.decode(String.self, forKey: .targetGroup)
        phase = try container.decode(EscalationPhase.self, forKey: .phase)
        attemptCount = try container.decode(Int.self, forKey: .attemptCount)
        lastAttemptAt = try container.decodeNullable(String.self, forKey: .lastAttemptAt)
        lastActivityAt = try container.decodeNullable(String.self, forKey: .lastActivityAt)
        brokenCount = try container.decode(Int.self, forKey: .brokenCount)
        lastFrictionType = try container.decodeNullable(FrictionType.self, forKey: .lastFrictionType)
        gate = try container.decodeNullable(Gate.self, forKey: .gate)
        pauseEndsAt = try container.decodeNullable(String.self, forKey: .pauseEndsAt)
        pendingExtension = try container.decode(Bool.self, forKey: .pendingExtension)
        intentionExpiresAt = try container.decodeNullable(String.self, forKey: .intentionExpiresAt)
        overrideReadyAt = try container.decodeNullable(String.self, forKey: .overrideReadyAt)
        overrideEndsAt = try container.decodeNullable(String.self, forKey: .overrideEndsAt)
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(targetGroup, forKey: .targetGroup)
        try container.encode(phase, forKey: .phase)
        try container.encode(attemptCount, forKey: .attemptCount)
        try container.encode(lastAttemptAt, forKey: .lastAttemptAt)
        try container.encode(lastActivityAt, forKey: .lastActivityAt)
        try container.encode(brokenCount, forKey: .brokenCount)
        try container.encode(lastFrictionType, forKey: .lastFrictionType)
        try container.encode(gate, forKey: .gate)
        try container.encode(pauseEndsAt, forKey: .pauseEndsAt)
        try container.encode(pendingExtension, forKey: .pendingExtension)
        try container.encode(intentionExpiresAt, forKey: .intentionExpiresAt)
        try container.encode(overrideReadyAt, forKey: .overrideReadyAt)
        try container.encode(overrideEndsAt, forKey: .overrideEndsAt)
    }
}
