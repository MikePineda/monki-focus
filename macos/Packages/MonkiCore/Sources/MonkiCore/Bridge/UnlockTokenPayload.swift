// SPDX-License-Identifier: AGPL-3.0-or-later

/// `unlock.token` (`unlock-token.schema.json`): a guardian-signed PASETO
/// v4.public token handed on to the extension as is. Untrusted in transit:
/// the extension verifies it itself. The app never accepts this type.
public struct UnlockTokenPayload: Hashable, Sendable {
    public var token: String

    public init(token: String) {
        self.token = token
    }

    private static let pattern = BridgePattern(#"^v4\.public\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$"#)

    init(json: JSONValue) throws(BridgeRejection) {
        token = try BridgePayloadReader(json, required: ["token"])
            .string("token", maxLength: 4096, pattern: Self.pattern)
    }

    var json: JSONValue {
        .object(["token": .string(token)])
    }
}
