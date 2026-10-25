// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

/// Rate limiting, the shared home folder and where a host manifest may point.
@Suite("Bridge hardening")
struct BridgeHardeningTests {
    @Test("a burst passes, the excess is dropped, and tokens come back with time")
    func aBurstPassesTheExcessIsDroppedAndTokensComeBackWithTime() {
        var limiter = BridgeRateLimiter(perSecond: 2, burst: 3)

        let burst = (0..<5).map { _ in limiter.allow(at: 10) }
        let afterHalfASecond = limiter.allow(at: 10.5)
        let rightAfter = limiter.allow(at: 10.5)

        #expect(burst == [true, true, true, false, false])
        #expect(afterHalfASecond)
        #expect(!rightAfter)
    }

    @Test("a clock that goes backwards never refills the bucket")
    func aClockThatGoesBackwardsNeverRefillsTheBucket() {
        var limiter = BridgeRateLimiter(perSecond: 100, burst: 1)

        let verdicts = [50.0, 40, 50].map { limiter.allow(at: $0) }

        #expect(verdicts == [true, false, false])
    }

    @Test("the home folder comes from the user database, not the environment")
    func theHomeFolderComesFromTheUserDatabaseNotTheEnvironment() throws {
        let home = try #require(UserHomeDirectory.path())

        #expect(home == NSHomeDirectoryForUser(NSUserName()))
        #expect(UserHomeDirectory.bridgeSocketPath() == (try BridgeSocketPath.path(home: home)))
    }

    @Test(
        "a host manifest points only at an installed app",
        arguments: [
            ("/Applications/MonkiFocus.app", true),
            ("/Users/someone/Applications/MonkiFocus.app", true),
            ("/Users/someone/Library/Developer/Xcode/DerivedData/x/Build/Products/Debug/MonkiFocus.app", true),
            ("/private/var/folders/ab/xyz/T/AppTranslocation/1234/d/MonkiFocus.app", false),
            ("/Volumes/MonkiFocus/MonkiFocus.app", false),
            ("/tmp/MonkiFocus.app", false),
            ("MonkiFocus.app", false),
            ("/Applications/MonkiFocus", false),
        ])
    func aHostManifestPointsOnlyAtAnInstalledApp(path: String, allowed: Bool) {
        #expect(HostManifestPlacement.allows(bundlePath: path) == allowed)
    }
}
