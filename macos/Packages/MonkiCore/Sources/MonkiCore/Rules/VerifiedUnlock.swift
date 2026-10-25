// SPDX-License-Identifier: AGPL-3.0-or-later

/// An unlock whose token an adapter already verified (signature, device,
/// replay). The engine only checks its time window and target.
public struct VerifiedUnlock: Hashable, Sendable, Codable {
    public var target: Target
    public var notBefore: String
    public var expiresAt: String

    public init(target: Target, notBefore: String, expiresAt: String) {
        self.target = target
        self.notBefore = notBefore
        self.expiresAt = expiresAt
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case target, notBefore, expiresAt
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        target = try container.decode(Target.self, forKey: .target)
        notBefore = try container.decode(String.self, forKey: .notBefore)
        expiresAt = try container.decode(String.self, forKey: .expiresAt)
    }
}
