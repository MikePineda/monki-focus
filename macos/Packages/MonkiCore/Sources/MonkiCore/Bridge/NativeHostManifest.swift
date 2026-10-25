// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// The native messaging host manifest (`dev.monkifocus.bridge.json`) that
/// tells Brave and Chrome where `monki-bridge` lives and which extensions
/// may start it. Only the listed extension ids can connect
/// (`allowed_origins`; Chromium accepts no wildcard there), and the manifest
/// never lists `externally_connectable` web origins.
public struct NativeHostManifest: Hashable, Sendable {
    public enum Failure: Error, Equatable, Sendable {
        case helperPathNotAbsolute
        case noExtensionIds
        case invalidExtensionId
    }

    public static let fileName = "\(BridgeContract.hostName).json"
    public static let description = "monki-focus bridge between the browser extension and the macOS app"

    /// Absolute path of `MonkiFocus.app/Contents/Helpers/monki-bridge`.
    public let helperPath: String
    /// Sorted, without duplicates.
    public let extensionIds: [String]

    public init(helperPath: String, extensionIds: [String]) throws(Failure) {
        guard helperPath.hasPrefix("/") else { throw .helperPathNotAbsolute }
        guard !extensionIds.isEmpty else { throw .noExtensionIds }
        guard extensionIds.allSatisfy(Self.isValidExtensionId) else { throw .invalidExtensionId }
        self.helperPath = helperPath
        self.extensionIds = Array(Set(extensionIds)).sorted()
    }

    /// A Chromium extension id: 32 letters `a` to `p` (the first 128 bits of
    /// the SHA-256 of the extension's public key, one letter per nibble).
    public static func isValidExtensionId(_ id: String) -> Bool {
        id.utf8.count == 32 && id.utf8.allSatisfy { (UInt8(ascii: "a")...UInt8(ascii: "p")).contains($0) }
    }

    public var allowedOrigins: [String] {
        extensionIds.map { "chrome-extension://\($0)/" }
    }

    public var json: JSONValue {
        .object([
            "name": .string(BridgeContract.hostName),
            "description": .string(Self.description),
            "path": .string(helperPath),
            "type": .string("stdio"),
            "allowed_origins": .array(allowedOrigins.map(JSONValue.string)),
        ])
    }

    public func encoded() -> Data {
        JSONValueWriter.data(json) + Data("\n".utf8)
    }
}
