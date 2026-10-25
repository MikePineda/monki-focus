// SPDX-License-Identifier: AGPL-3.0-or-later

/// `hello` (`hello.schema.json`): the first message of every connection.
public struct HelloPayload: Hashable, Sendable {
    /// The browser the extension runs in; names the app's web bucket.
    public enum Browser: String, Hashable, Sendable, CaseIterable {
        case brave, chrome, other
    }

    public var extensionVersion: String
    public var browser: Browser

    public init(extensionVersion: String, browser: Browser) {
        self.extensionVersion = extensionVersion
        self.browser = browser
    }

    init(json: JSONValue) throws(BridgeRejection) {
        let reader = try BridgePayloadReader(json, required: ["extensionVersion", "schemaVersion", "browser"])
        extensionVersion = try reader.string("extensionVersion", maxLength: 32, pattern: .version)
        guard try reader.integer("schemaVersion", in: 1...1) == BridgeContract.schemaVersion else {
            throw .invalidPayload
        }
        guard let browser = Browser(rawValue: try reader.literal("browser", in: Set(Browser.allCases.map(\.rawValue))))
        else { throw .invalidPayload }
        self.browser = browser
    }

    var json: JSONValue {
        .object([
            "extensionVersion": .string(extensionVersion),
            "schemaVersion": .number(Double(BridgeContract.schemaVersion)),
            "browser": .string(browser.rawValue),
        ])
    }
}
