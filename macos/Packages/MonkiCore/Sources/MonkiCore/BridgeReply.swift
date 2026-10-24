// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// Replies `monki-bridge` sends on its own, without the app.
public enum BridgeReply {
    /// Sent when the menu-bar app is not running (in the M1 stub, always).
    public static let appUnavailable = Data(#"{"type":"app.unavailable"}"#.utf8)
}
