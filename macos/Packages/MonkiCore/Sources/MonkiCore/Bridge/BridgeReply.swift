// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// Replies `monki-bridge` sends on its own, without the app.
public enum BridgeReply {
    /// The id of `monki-bridge`'s own `app.unavailable`.
    public static let appUnavailableId = "app-unavailable"

    /// Sent when the menu-bar app is not running: its socket is missing or
    /// refuses the connection. `monki-bridge` exits right after it.
    public static let appUnavailable = BridgeMessage.appUnavailable.encoded(id: appUnavailableId)
}
