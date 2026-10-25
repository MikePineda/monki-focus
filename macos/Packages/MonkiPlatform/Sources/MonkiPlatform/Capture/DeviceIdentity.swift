// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin
import Foundation

/// The bucket identity of this Mac: its local host name (as aw-watcher
/// buckets use, kept on the device) and a random device id generated once.
public struct DeviceIdentity: Hashable, Sendable {
    public static let deviceIdKey = "capture.deviceId"

    public var hostname: String
    public var deviceId: String

    public init(hostname: String, deviceId: String) {
        self.hostname = hostname
        self.deviceId = deviceId
    }

    /// This Mac's identity; the device id is created and stored on first use.
    public static func current(defaults: UserDefaults = .standard) -> DeviceIdentity {
        let deviceId: String
        if let stored = defaults.string(forKey: deviceIdKey), !stored.isEmpty {
            deviceId = stored
        } else {
            deviceId = UUID().uuidString.lowercased()
            defaults.set(deviceId, forKey: deviceIdKey)
        }
        return DeviceIdentity(hostname: localHostname(), deviceId: deviceId)
    }

    /// `gethostname` without the `.local` suffix; "localhost" when unavailable.
    static func localHostname() -> String {
        var buffer = [CChar](repeating: 0, count: 256)
        guard gethostname(&buffer, buffer.count) == 0 else { return "localhost" }
        let name = String(decoding: buffer.prefix { $0 != 0 }.map { UInt8(bitPattern: $0) }, as: UTF8.self)
        let trimmed = name.hasSuffix(".local") ? String(name.dropLast(6)) : name
        return trimmed.isEmpty ? "localhost" : trimmed
    }
}
