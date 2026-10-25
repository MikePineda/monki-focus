// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// Handles the validated messages of one connection, on that connection's
/// queue. It only ever sees what the extension may send
/// (`BridgeMessage.decode(_:from: .extensionToApp)`), so it can report and
/// answer but never be told to change rules or unlock anything.
public protocol BridgeMessageHandler: Sendable {
    /// Returns the replies for the same connection, in order.
    func handle(_ message: BridgeMessage, session: inout BridgeSession) -> [BridgeMessage]
}
