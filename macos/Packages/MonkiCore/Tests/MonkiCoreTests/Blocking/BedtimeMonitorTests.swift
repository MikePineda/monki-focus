// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import Testing

/// What the Mac shows for bedtime: one warning notification per lead-up, and
/// a dimming overlay on every screen while bedtime is active, until an
/// emergency override is granted.
@Suite("bedtime monitor")
struct BedtimeMonitorTests {
    @Test("entering the warning notifies once")
    func enteringTheWarningNotifiesOnce() {
        var monitor = BedtimeMonitor()
        _ = monitor.update(phase: .inactive, emergency: .none)

        let first = monitor.update(phase: .warning, emergency: .none)
        let second = monitor.update(phase: .warning, emergency: .none)

        #expect(first.notifyWarning)
        #expect(!second.notifyWarning)
        #expect(first.overlay == .hidden)
    }

    @Test("starting during the warning still notifies once")
    func startingDuringTheWarningStillNotifiesOnce() {
        var monitor = BedtimeMonitor()

        #expect(monitor.update(phase: .warning, emergency: .none).notifyWarning)
    }

    @Test("starting during bedtime dims without a warning")
    func startingDuringBedtimeDimsWithoutAWarning() {
        var monitor = BedtimeMonitor()

        let update = monitor.update(phase: .active, emergency: .none)

        #expect(!update.notifyWarning)
        #expect(update.overlay == .dimmed(emergency: .none))
    }

    @Test("the next night warns again")
    func theNextNightWarnsAgain() {
        var monitor = BedtimeMonitor()
        _ = monitor.update(phase: .warning, emergency: .none)
        _ = monitor.update(phase: .active, emergency: .none)
        _ = monitor.update(phase: .inactive, emergency: .none)

        #expect(monitor.update(phase: .warning, emergency: .none).notifyWarning)
    }

    @Test("the overlay shows the emergency wait while it runs")
    func theOverlayShowsTheEmergencyWaitWhileItRuns() {
        var monitor = BedtimeMonitor()

        let update = monitor.update(phase: .active, emergency: .waiting(remaining: .seconds(90)))

        #expect(update.overlay == .dimmed(emergency: .waiting(remaining: .seconds(90))))
    }

    @Test("a granted emergency removes the overlay")
    func aGrantedEmergencyRemovesTheOverlay() {
        var monitor = BedtimeMonitor()

        #expect(monitor.update(phase: .active, emergency: .active(remaining: .seconds(600))).overlay == .hidden)
    }

    @Test("the overlay is gone outside bedtime", arguments: [BedtimePhase.inactive, .warning])
    func theOverlayIsGoneOutsideBedtime(phase: BedtimePhase) {
        var monitor = BedtimeMonitor()

        #expect(monitor.update(phase: phase, emergency: .waiting(remaining: .seconds(10))).overlay == .hidden)
    }
}
