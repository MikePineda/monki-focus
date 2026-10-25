// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// `WindowTitleSetting` in `UserDefaults` (`capture.windowTitles`, absent = off).
public struct UserDefaultsWindowTitleSetting: WindowTitleSetting, @unchecked Sendable {
    public static let key = "capture.windowTitles"

    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public var titlesEnabled: Bool {
        defaults.bool(forKey: Self.key)
    }
}
