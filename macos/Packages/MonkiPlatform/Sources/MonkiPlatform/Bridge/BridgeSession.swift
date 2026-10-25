// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// What one connection has learnt from its `hello`.
public struct BridgeSession: Hashable, Sendable {
    /// The browser named by the connection's `hello`; nil before it.
    public var browser: HelloPayload.Browser?

    public init(browser: HelloPayload.Browser? = nil) {
        self.browser = browser
    }
}
