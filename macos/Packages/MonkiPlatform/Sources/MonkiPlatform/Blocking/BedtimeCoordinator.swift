// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// Bedtime on the Mac (plan §4.6): once a second it evaluates the rule set's
/// bedtime (`BedtimeWindow`) on the wall clock, posts the warning once per
/// lead-up and dims every screen while bedtime is active, until the bedtime
/// emergency override is granted. Hiding the apps bedtime blocks is
/// `AppActivationGate`'s job (the engine decides `schedule_bedtime`).
///
/// A rule set whose zone cannot be resolved never dims the screens: the
/// overlay would trap the user, and the engine already fails closed per app.
@MainActor
public final class BedtimeCoordinator: BedtimeOverlayActions {
    private let rules: any RulesProvider
    private let overrides: EmergencyOverrides
    private let presenter: any BedtimeOverlayPresenter
    private let notifier: any BedtimeWarningNotifier
    private let timers: any RepeatingTimerScheduler
    private let wall: any MonkiCore.Clock
    private var monitor = BedtimeMonitor()
    private var shown: BedtimeOverlay = .hidden
    private var timer: (any RepeatingTimer)?

    public init(
        rules: any RulesProvider,
        overrides: EmergencyOverrides,
        presenter: any BedtimeOverlayPresenter,
        notifier: any BedtimeWarningNotifier,
        timers: any RepeatingTimerScheduler,
        wall: any MonkiCore.Clock
    ) {
        self.rules = rules
        self.overrides = overrides
        self.presenter = presenter
        self.notifier = notifier
        self.timers = timers
        self.wall = wall
    }

    public func start() {
        timer = timers.schedule(every: .seconds(1)) { [weak self] in self?.tick() }
        tick()
    }

    public func stop() {
        timer?.cancel()
        timer = nil
        presenter.hide()
        shown = .hidden
    }

    func tick() {
        overrides.advance()
        let update = monitor.update(phase: phase(), emergency: overrides.status(of: bedtimeGroup))
        if update.notifyWarning { notifier.notifyWarning() }
        guard update.overlay != shown else { return }
        shown = update.overlay
        switch update.overlay {
        case .hidden:
            presenter.hide()
        case .dimmed(let emergency):
            presenter.show(emergency: emergency, actions: self)
        }
    }

    private func phase() -> BedtimePhase {
        guard let ruleset = rules.current?.ruleset else { return .inactive }
        do {
            return try BedtimeWindow(ruleset: ruleset).phase(atEpochSeconds: WallSeconds.of(wall))
        } catch {
            BlockingLog.failure("bedtime not evaluated", error)
            return .inactive
        }
    }

    public func requestEmergency() {
        overrides.request(bedtimeGroup)
        tick()
    }

    public func cancelEmergency() {
        overrides.cancel(bedtimeGroup)
        tick()
    }
}
