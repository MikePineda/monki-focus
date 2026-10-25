// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiPlatform
import Testing

/// Defaults of the capture settings, on a throwaway `UserDefaults` suite.
@Suite("capture defaults")
struct CaptureDefaultsTests {
    private let suite = "dev.monkifocus.tests.\(UUID().uuidString)"

    private func withDefaults(_ body: (UserDefaults) throws -> Void) throws {
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        try body(defaults)
    }

    @Test("window titles are off until the user turns them on")
    func windowTitlesAreOffUntilTheUserTurnsThemOn() throws {
        try withDefaults { defaults in
            let setting = UserDefaultsWindowTitleSetting(defaults: defaults)
            #expect(setting.titlesEnabled == false)

            defaults.set(true, forKey: UserDefaultsWindowTitleSetting.key)
            #expect(setting.titlesEnabled)
        }
    }

    @Test("the device id is generated once and then kept")
    func theDeviceIdIsGeneratedOnceAndThenKept() throws {
        try withDefaults { defaults in
            let first = DeviceIdentity.current(defaults: defaults)
            let second = DeviceIdentity.current(defaults: defaults)

            #expect(first.deviceId == second.deviceId)
            #expect(UUID(uuidString: first.deviceId) != nil)
            #expect(!first.hostname.isEmpty && !first.hostname.hasSuffix(".local"))
        }
    }
}
