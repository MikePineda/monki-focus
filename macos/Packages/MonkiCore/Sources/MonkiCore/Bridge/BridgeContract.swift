// SPDX-License-Identifier: AGPL-3.0-or-later

/// Constants of the native messaging contract (docs/CONTRACTS.md, "Native
/// messaging"), shared by `monki-bridge`, the app and the installer.
public enum BridgeContract {
    /// The native messaging host name the extension connects to.
    public static let hostName = "dev.monkifocus.bridge"
    /// The envelope version (`v`).
    public static let envelopeVersion = 1
    /// The contract version `hello` and `hello.ack` carry.
    public static let schemaVersion = 1
    /// Largest serialised message in either direction, in bytes (the
    /// browser's limit for host-to-extension messages).
    public static let maxMessageBytes = NativeMessageFrame.maxPayloadBytes
    /// The socket, relative to the user's home folder.
    public static let socketPathInHome = "Library/Application Support/monki-focus/bridge.sock"
    /// `sockaddr_un.sun_path` holds 104 bytes including the terminating NUL.
    public static let maxSocketPathBytes = 103
}
