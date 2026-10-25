// SPDX-License-Identifier: AGPL-3.0-or-later

/// Which side sent a native messaging message. Each message type belongs to
/// exactly one direction; a type sent the other way is refused
/// (`BridgeRejection.wrongDirection`), so the app never takes a command.
public enum BridgeDirection: String, Hashable, Sendable, CaseIterable {
    /// From the browser extension, through `monki-bridge`, to the app.
    case extensionToApp = "extension-to-app"
    /// From the app (or `monki-bridge` itself), to the browser extension.
    case appToExtension = "app-to-extension"
}
