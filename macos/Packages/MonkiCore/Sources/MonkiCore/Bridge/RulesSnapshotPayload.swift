// SPDX-License-Identifier: AGPL-3.0-or-later

/// `rules.snapshot` (`rules-snapshot.schema.json`): the rule set the app
/// enforces, sent to the extension. The bridge checks only that `ruleset` is
/// an object; the extension validates it against the rules schema before use.
/// The app never accepts this type: rules never flow into the app over the bridge.
public struct RulesSnapshotPayload: Hashable, Sendable {
    public var issuedAt: String
    public var ruleset: [String: JSONValue]

    public init(issuedAt: String, ruleset: [String: JSONValue]) {
        self.issuedAt = issuedAt
        self.ruleset = ruleset
    }

    init(json: JSONValue) throws(BridgeRejection) {
        let reader = try BridgePayloadReader(json, required: ["issuedAt", "ruleset"])
        issuedAt = try reader.string("issuedAt", pattern: .utcInstant)
        ruleset = try reader.object("ruleset")
    }

    var json: JSONValue {
        .object(["issuedAt": .string(issuedAt), "ruleset": .object(ruleset)])
    }
}
