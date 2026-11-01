// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform

/// Records what app blocking did to other apps.
@MainActor
final class RecordingApplicationControl: ApplicationControl {
    private(set) var hidden: [Int32] = []
    private(set) var activated: [Int32] = []

    func hide(processIdentifier: Int32) { hidden.append(processIdentifier) }
    func activate(processIdentifier: Int32) { activated.append(processIdentifier) }
}

/// Records the gate panel's states.
@MainActor
final class RecordingGatePresenter: GatePresenter {
    private(set) var shown: [GatePanelState] = []
    private(set) var dismissals = 0
    private(set) var isShowing = false

    var last: GatePanelState? { shown.last }

    func show(_ state: GatePanelState, actions: any GatePanelActions) {
        shown.append(state)
        isShowing = true
    }

    func dismiss() {
        dismissals += 1
        isShowing = false
    }
}

/// Records the bedtime overlay.
@MainActor
final class RecordingBedtimeOverlay: BedtimeOverlayPresenter {
    private(set) var shown: [EmergencyStatus] = []
    private(set) var hides = 0
    private(set) var isShowing = false

    func show(emergency: EmergencyStatus, actions: any BedtimeOverlayActions) {
        shown.append(emergency)
        isShowing = true
    }

    func hide() {
        hides += 1
        isShowing = false
    }
}

/// Counts bedtime warnings.
@MainActor
final class CountingBedtimeWarningNotifier: BedtimeWarningNotifier {
    private(set) var warnings = 0

    func notifyWarning() { warnings += 1 }
}

/// A rule set the test sets.
@MainActor
final class StaticRulesProvider: RulesProvider {
    var current: RulesSnapshot?

    init(_ ruleset: Ruleset?) {
        current = ruleset.map {
            RulesSnapshot(ruleset: $0, catalog: RulesCatalog(siteProfiles: [], surfaces: [], defaultCategories: []))
        }
    }
}

/// Records bypass events; `failing` makes every write throw.
final class RecordingBypassOutbox: BypassOutbox {
    struct WriteFailed: Error {}

    var failing = false
    private(set) var records: [BypassEventRecord] = []

    func enqueue(_ record: BypassEventRecord, enqueuedAt: String) throws {
        if failing { throw WriteFailed() }
        records.append(record)
    }
}

/// Synthetic blocking rule sets (generic bundle ids, UTC).
enum SampleRules {
    static let games = ActivatedApplication(
        app: ForegroundApp(bundleIdentifier: "org.example.Games", localizedName: "Games"), processIdentifier: 201)
    static let chat = ActivatedApplication(
        app: ForegroundApp(bundleIdentifier: "org.example.Chat", localizedName: "Chat"), processIdentifier: 202)
    static let own = ActivatedApplication(
        app: ForegroundApp(bundleIdentifier: "dev.monkifocus.mac", localizedName: "Monki Focus"),
        processIdentifier: 1)

    /// Games is friction, chat is blocked; bedtime 01:00–02:00 UTC every day, warned 30 min before.
    static func ruleset(bedtimeEnabled: Bool = true, timeZone: String = "UTC") -> Ruleset {
        Ruleset(
            revision: 1,
            updatedAt: "2026-10-01T00:00:00Z",
            timeZone: timeZone,
            rules: [
                Rule(id: "r-games", target: .app(package: "org.example.Games"), mode: .friction),
                Rule(id: "r-chat", target: .app(package: "org.example.Chat"), mode: .block),
            ],
            categories: [CategoryAssignment(target: .app(package: "org.example.Games"), level: 10, category: "games")],
            bedtime: Bedtime(
                enabled: bedtimeEnabled,
                days: Weekday.allCases,
                start: TimeOfDay(hour: 1, minute: 0),
                end: TimeOfDay(hour: 2, minute: 0),
                warnMinutesBefore: 30
            ),
            workHours: Schedule(
                days: [.mon], start: TimeOfDay(hour: 9, minute: 0), end: TimeOfDay(hour: 17, minute: 0))
        )
    }
}
