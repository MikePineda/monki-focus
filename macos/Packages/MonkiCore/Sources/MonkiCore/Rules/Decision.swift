// SPDX-License-Identifier: AGPL-3.0-or-later

/// The output of `decide` (`decision.schema.json`). Two independent axes;
/// `ruleId`, `reason` and `explanationKey` describe the primary outcome.
/// `gate` is present iff access is `gate`. `validUntil` is the earliest
/// instant the same inputs can decide differently (null only for `engine_error`).
public struct Decision: Hashable, Sendable, Codable {
    public var access: Access
    public var content: Content
    public var ruleId: String?
    public var reason: ReasonCode
    public var gate: Gate?
    public var explanationKey: ExplanationKey
    public var validUntil: String?

    public init(
        access: Access,
        content: Content,
        ruleId: String?,
        reason: ReasonCode,
        gate: Gate? = nil,
        explanationKey: ExplanationKey,
        validUntil: String?
    ) {
        self.access = access
        self.content = content
        self.ruleId = ruleId
        self.reason = reason
        self.gate = gate
        self.explanationKey = explanationKey
        self.validUntil = validUntil
    }

    /// SEMANTICS.md §14: blocks and hides the feed, no gate, no validity.
    public static let engineError = Decision(
        access: .block,
        content: .hideFeed,
        ruleId: nil,
        reason: .engineError,
        explanationKey: .engineError,
        validUntil: nil
    )

    enum CodingKeys: String, CodingKey, CaseIterable {
        case access, content, ruleId, reason, gate, explanationKey, validUntil
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        access = try container.decode(Access.self, forKey: .access)
        content = try container.decode(Content.self, forKey: .content)
        ruleId = try container.decodeNullable(String.self, forKey: .ruleId)
        reason = try container.decode(ReasonCode.self, forKey: .reason)
        gate = try container.decodeIfPresent(Gate.self, forKey: .gate)
        explanationKey = try container.decode(ExplanationKey.self, forKey: .explanationKey)
        validUntil = try container.decodeNullable(String.self, forKey: .validUntil)
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(access, forKey: .access)
        try container.encode(content, forKey: .content)
        try container.encode(ruleId, forKey: .ruleId)
        try container.encode(reason, forKey: .reason)
        try container.encodeIfPresent(gate, forKey: .gate)
        try container.encode(explanationKey, forKey: .explanationKey)
        try container.encode(validUntil, forKey: .validUntil)
    }
}
