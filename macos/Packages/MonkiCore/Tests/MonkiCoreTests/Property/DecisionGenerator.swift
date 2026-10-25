// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore

/// SplitMix64: a tiny seeded generator, so a failing property case is
/// reproduced by its seed alone.
struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed
    }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var mixed = state
        mixed = (mixed ^ (mixed >> 30)) &* 0xBF58_476D_1CE4_E5B9
        mixed = (mixed ^ (mixed >> 27)) &* 0x94D0_49BB_1331_11EB
        return mixed ^ (mixed >> 31)
    }
}

/// Synthetic decision inputs (generic domains, ids and zones), the Swift twin
/// of `packages/engine/tests/property/DecisionArbitraries.ts`.
struct DecisionGenerator {
    static let domains = [
        "reddit.com", "www.reddit.com", "old.reddit.com", "x.com", "twitter.com", "youtube.com", "m.youtube.com",
        "instagram.com", "news.example.org",
    ]
    static let paths = ["/r/*", "/r/AskHistorians/**", "/watch", "/**", "/shorts/**", "/home", "/*/status/**"]
    static let surfaces = [
        "reddit.feed", "reddit.permalink", "reddit.search", "x.home", "x.status", "youtube.home", "youtube.shorts",
        "youtube.watch", "instagram.reels", "instagram.reel_from_dm",
    ]
    static let packages = ["com.instagram.android", "com.reddit.frontpage", "com.example.reader"]
    static let urls = [
        "reddit.com", "https://www.reddit.com/", "https://www.reddit.com/r/AskHistorians/",
        "https://old.reddit.com/r/AskHistorians/comments/xyz789/a_question/",
        "https://www.reddit.com/search/?q=history",
        "x.com/home", "https://twitter.com/someone/status/123", "m.youtube.com",
        "https://www.youtube.com/shorts/abc123DEF45", "https://www.youtube.com/watch?v=abc123DEF45",
        "https://www.instagram.com/reels/", "news.example.org", "https://news.example.org/today", "chrome://settings/",
        "https://www.reddit.com/r%2fAskHistorians",
    ]
    static let zones = ["UTC", "Australia/Sydney", "Europe/London", "Pacific/Honolulu"]
    static let times = ["00:00", "07:00", "09:00", "17:30", "22:00", "22:30"]
    static let ruleIds = ["r-a", "r-b", "r-c", "r-d", "r-e", "r-f", "r-g", "r-h"]
    /// Days around the 2026 DST transitions of London and Sydney (UTC and Honolulu have none).
    static let weeks = ["2026-03-27T00:00:00Z", "2026-04-03T00:00:00Z", "2026-10-02T00:00:00Z", "2026-10-23T00:00:00Z"]

    var random: SeededGenerator

    init(seed: UInt64) {
        random = SeededGenerator(seed: seed)
    }

    mutating func pick<T>(_ options: [T]) -> T {
        options[Int.random(in: 0..<options.count, using: &random)]
    }

    mutating func chance(_ probability: Double) -> Bool {
        Double.random(in: 0..<1, using: &random) < probability
    }

    mutating func subset<T>(_ options: [T], minCount: Int = 0, maxCount: Int? = nil) -> [T] {
        var chosen = options.filter { _ in chance(0.5) }
        if chosen.count < minCount { chosen = Array(options.prefix(minCount)) }
        if let maxCount, chosen.count > maxCount { chosen = Array(chosen.prefix(maxCount)) }
        return chosen
    }

    mutating func time() -> TimeOfDay {
        TimeOfDay(pick(Self.times)) ?? TimeOfDay(hour: 0, minute: 0)
    }

    mutating func target() -> Target {
        switch Int.random(in: 0..<4, using: &random) {
        case 0: .site(domain: pick(Self.domains), path: nil)
        case 1: .site(domain: pick(Self.domains), path: pick(Self.paths))
        case 2: .surface(pick(Self.surfaces))
        default: .app(package: pick(Self.packages))
        }
    }

    mutating func schedule() -> Schedule {
        Schedule(days: subset(Weekday.allCases, minCount: 1), start: time(), end: time())
    }

    mutating func schedules() -> [RuleSchedule] {
        switch Int.random(in: 0..<3, using: &random) {
        case 0: []
        case 1: (0..<Int.random(in: 1...2, using: &random)).map { _ in .window(schedule()) }
        default: [.workHours]
        }
    }

    mutating func rule(id: String) -> Rule {
        let mode = pick(RuleMode.allCases)
        let budget: Int? = chance(0.5) ? pick([1, 15, 30]) : nil
        return Rule(
            id: id,
            target: target(),
            mode: mode,
            schedules: schedules(),
            dailyBudgetMinutes: mode == .hideFeed ? nil : budget,
            enabled: pick([true, true, true, true, false])
        )
    }

    mutating func ruleset() -> Ruleset {
        let timeZone = pick(Self.zones)
        let pending: String? = chance(0.3) ? pick(Self.zones) : nil
        let rules = subset(Self.ruleIds, maxCount: 6).map { rule(id: $0) }
        var categories: [CategoryAssignment] = []
        for _ in 0..<Int.random(in: 0...3, using: &random) {
            let assignment = CategoryAssignment(
                target: target(),
                level: pick([0, 25, 50, 75, 100]),
                category: pick(["social", "reading", "video"])
            )
            if !categories.contains(where: { $0.target == assignment.target }) { categories.append(assignment) }
        }
        let weekdays = Weekday.allCases
        let workdays: [Weekday] = [.mon, .tue, .wed, .thu, .fri]
        return Ruleset(
            revision: 1,
            updatedAt: "2026-01-01T00:00:00Z",
            timeZone: timeZone,
            pendingTimeZone: pending,
            rules: rules,
            categories: categories,
            bedtime: Bedtime(
                enabled: chance(0.5),
                days: weekdays,
                start: TimeOfDay(pick(["22:30", "21:00", "00:00"])) ?? TimeOfDay(hour: 22, minute: 30),
                end: TimeOfDay(hour: 7, minute: 0),
                warnMinutesBefore: 30
            ),
            workHours: Schedule(
                days: workdays,
                start: TimeOfDay(hour: 9, minute: 0),
                end: TimeOfDay(hour: 17, minute: 30)
            )
        )
    }

    mutating func observation() -> Observation {
        chance(0.5)
            ? .site(urlText: pick(Self.urls))
            : .app(package: pick(Self.packages), surface: chance(0.5) ? pick(Self.surfaces) : nil)
    }

    /// An instant within nine days of 2026-10-24.
    mutating func instant(from start: Int = 1_792_800_000, span: Int = 9 * 86_400) -> String {
        utcInstantOf(start + Int.random(in: 0...span, using: &random))
    }

    /// An instant within three days of one of the DST weeks.
    mutating func instantNearTransitions() -> String {
        let start = (try? epochSecondsOf(pick(Self.weeks))) ?? 0
        return instant(from: start, span: 3 * 86_400)
    }

    mutating func nullableInstant() -> String? {
        chance(0.5) ? instant() : nil
    }

    mutating func escalationState(group: String) -> EscalationState {
        EscalationState(
            targetGroup: group,
            phase: pick(EscalationPhase.allCases),
            attemptCount: Int.random(in: 0...6, using: &random),
            lastAttemptAt: nullableInstant(),
            lastActivityAt: nullableInstant(),
            brokenCount: Int.random(in: 0...4, using: &random),
            lastFrictionType: chance(0.5) ? pick(FrictionType.allCases) : nil,
            gate: nil,
            pauseEndsAt: nullableInstant(),
            pendingExtension: chance(0.5),
            intentionExpiresAt: nullableInstant(),
            overrideReadyAt: nullableInstant(),
            overrideEndsAt: nullableInstant()
        )
    }

    mutating func state(pendingEffectiveFrom: String? = nil) -> DecisionState {
        let groups = subset(Self.ruleIds + ["bedtime"], maxCount: 4)
        let usageDate: String? = chance(0.6) ? pick(["2026-10-25", "2026-10-26", "2026-10-27"]) : nil
        var seconds: [String: Int] = [:]
        for id in Self.ruleIds where chance(0.3) { seconds[id] = Int.random(in: 0...3600, using: &random) }
        let unlocks = (0..<Int.random(in: 0...2, using: &random)).map { _ in
            VerifiedUnlock(target: target(), notBefore: instant(), expiresAt: instant())
        }
        return DecisionState(
            escalation: groups.map { escalationState(group: $0) },
            usage: usageDate.map { DailyUsage(localDate: $0, secondsByRule: seconds) },
            unlocks: unlocks,
            guardianLinked: chance(0.5),
            pendingEffectiveFrom: pendingEffectiveFrom
        )
    }
}
