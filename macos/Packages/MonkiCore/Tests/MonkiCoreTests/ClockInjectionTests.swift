// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import MonkiCoreTesting
import Testing

/// The domain never reads the time on its own: every policy takes the wall
/// and monotonic clocks as parameters, so tests pin them and a manual clock
/// change on the Mac cannot leak in through a hidden `Date()`.
@Suite("Clock injection")
struct ClockInjectionTests {
    @Test("clock is injected, not implicit")
    func clockIsInjectedNotImplicit() throws {
        let sources = RepositoryPaths.monkiCoreSources

        let violations = try ImplicitClockScan.scan(sources)

        #expect(violations.isEmpty, "Inject the clock instead of reading it implicitly: \(violations)")
    }

    @Test("implicit clock reads are detected")
    func implicitClockReadsAreDetected() {
        let implicit = [
            "let at = Date()",
            "let at = Date( )",
            "let at = Date.now",
            "let at = Date(timeIntervalSinceNow: 5)",
            "let t = CFAbsoluteTimeGetCurrent()",
            "let t = ProcessInfo.processInfo.systemUptime",
            "let t = DispatchTime.now()",
            "let t = ContinuousClock.now",
            "let t = SuspendingClock().now",
            "let t = mach_absolute_time()",
            "let t = clock_gettime_nsec_np(CLOCK_UPTIME_RAW)",
        ]
        let injected = [
            "let at = clock.now()",
            "let t = monotonic.elapsed()",
            "func decide(at now: Date, clock: some Clock)",
            "let at = Date(timeIntervalSince1970: 0)",
            "    /// Domain code never calls `Date()`.",
        ]

        for line in implicit {
            #expect(ImplicitClockScan.isImplicit(line), "\(line)")
        }
        for line in injected {
            #expect(!ImplicitClockScan.isImplicit(line), "\(line)")
        }
    }

    @Test("core imports no UI framework")
    func coreImportsNoUIFramework() throws {
        let sources = RepositoryPaths.monkiCoreSources

        let violations = try ImplicitClockScan.swiftFiles(under: sources).flatMap { file in
            try String(contentsOf: file, encoding: .utf8)
                .split(separator: "\n")
                .filter {
                    $0.range(of: #"^\s*import\s+(AppKit|SwiftUI|UIKit|Cocoa)\b"#, options: .regularExpression) != nil
                }
                .map { "\(file.lastPathComponent): \($0)" }
        }

        #expect(violations.isEmpty, "MonkiCore stays pure: \(violations)")
    }

    @Test("fixed clock returns the pinned instant until advanced")
    func fixedClockReturnsThePinnedInstantUntilAdvanced() {
        let clock = FixedClock(Date(timeIntervalSince1970: 1_767_603_600))

        #expect(clock.now() == Date(timeIntervalSince1970: 1_767_603_600))
        clock.advance(by: 90)
        #expect(clock.now() == Date(timeIntervalSince1970: 1_767_603_690))
    }

    @Test("fake monotonic clock only moves forward when told")
    func fakeMonotonicClockOnlyMovesForwardWhenTold() {
        let monotonic = FakeMonotonicClock()

        #expect(monotonic.elapsed() == .zero)
        monotonic.advance(by: .seconds(5))
        monotonic.advance(by: .milliseconds(250))
        #expect(monotonic.elapsed() == .milliseconds(5_250))
    }

    @Test("both clocks pass through a protocol boundary")
    func bothClocksPassThroughAProtocolBoundary() {
        let wall: any MonkiCore.Clock = FixedClock(Date(timeIntervalSince1970: 0))
        let monotonic: any MonotonicClock = FakeMonotonicClock(start: .seconds(42))

        #expect(wall.now() == Date(timeIntervalSince1970: 0))
        #expect(monotonic.elapsed() == .seconds(42))
    }
}
