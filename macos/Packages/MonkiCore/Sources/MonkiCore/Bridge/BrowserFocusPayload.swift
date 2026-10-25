// SPDX-License-Identifier: AGPL-3.0-or-later

/// `browser.focus` (`browser-focus.schema.json`): a browser window gained or lost focus.
public struct BrowserFocusPayload: Hashable, Sendable {
    public var focused: Bool

    public init(focused: Bool) {
        self.focused = focused
    }

    init(json: JSONValue) throws(BridgeRejection) {
        focused = try BridgePayloadReader(json, required: ["focused"]).bool("focused")
    }

    var json: JSONValue {
        .object(["focused": .bool(focused)])
    }
}
