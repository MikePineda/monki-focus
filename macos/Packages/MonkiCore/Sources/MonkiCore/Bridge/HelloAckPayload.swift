// SPDX-License-Identifier: AGPL-3.0-or-later

/// `hello.ack` (`hello-ack.schema.json`): the app aggregates this device's
/// activity (`aggregator: "mac"`), so the extension stops syncing its own
/// blocks and keeps only its local stats.
public struct HelloAckPayload: Hashable, Sendable {
    public static let macAggregator = "mac"

    public var appVersion: String

    public init(appVersion: String) {
        self.appVersion = appVersion
    }

    init(json: JSONValue) throws(BridgeRejection) {
        let reader = try BridgePayloadReader(json, required: ["aggregator", "appVersion", "schemaVersion"])
        _ = try reader.literal("aggregator", in: [Self.macAggregator])
        appVersion = try reader.string("appVersion", maxLength: 32, pattern: .version)
        _ = try reader.integer("schemaVersion", in: BridgeContract.schemaVersion...BridgeContract.schemaVersion)
    }

    var json: JSONValue {
        .object([
            "aggregator": .string(Self.macAggregator),
            "appVersion": .string(appVersion),
            "schemaVersion": .number(Double(BridgeContract.schemaVersion)),
        ])
    }
}
