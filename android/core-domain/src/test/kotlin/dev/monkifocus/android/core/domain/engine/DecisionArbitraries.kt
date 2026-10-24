// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.AppObservation
import dev.monkifocus.android.core.domain.rules.AppTarget
import dev.monkifocus.android.core.domain.rules.Bedtime
import dev.monkifocus.android.core.domain.rules.CategoryAssignment
import dev.monkifocus.android.core.domain.rules.DailyUsage
import dev.monkifocus.android.core.domain.rules.DecisionState
import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.EscalationState
import dev.monkifocus.android.core.domain.rules.FrictionType
import dev.monkifocus.android.core.domain.rules.Observation
import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.RuleSchedule
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.Schedule
import dev.monkifocus.android.core.domain.rules.ScheduleRef
import dev.monkifocus.android.core.domain.rules.SiteObservation
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.core.domain.rules.SurfaceTarget
import dev.monkifocus.android.core.domain.rules.Target
import dev.monkifocus.android.core.domain.rules.VerifiedUnlock
import dev.monkifocus.android.core.domain.rules.Weekday
import kotlin.random.Random

/**
 * Seeded generators of synthetic decision inputs (generic domains, ids and
 * zones), the Kotlin twin of `DecisionArbitraries.ts`. A failing seed
 * reproduces exactly.
 */
class DecisionArbitraries(
    private val random: Random,
) {
    private val domains =
        listOf(
            "reddit.com",
            "www.reddit.com",
            "old.reddit.com",
            "x.com",
            "twitter.com",
            "youtube.com",
            "m.youtube.com",
            "instagram.com",
            "news.example.org",
        )
    private val paths = listOf("/r/*", "/r/AskHistorians/**", "/watch", "/**", "/shorts/**", "/home", "/*/status/**")
    private val surfaces =
        listOf(
            "reddit.feed",
            "reddit.permalink",
            "reddit.search",
            "x.home",
            "x.status",
            "youtube.home",
            "youtube.shorts",
            "youtube.watch",
            "instagram.reels",
            "instagram.reel_from_dm",
        )
    private val packages = listOf("com.instagram.android", "com.reddit.frontpage", "com.example.reader")
    private val urls =
        listOf(
            "reddit.com",
            "https://www.reddit.com/",
            "https://www.reddit.com/r/AskHistorians/",
            "https://old.reddit.com/r/AskHistorians/comments/xyz789/a_question/",
            "https://www.reddit.com/search/?q=history",
            "x.com/home",
            "https://twitter.com/someone/status/123",
            "m.youtube.com",
            "https://www.youtube.com/shorts/abc123DEF45",
            "https://www.youtube.com/watch?v=abc123DEF45",
            "https://www.instagram.com/reels/",
            "news.example.org",
            "https://news.example.org/today",
            "chrome://settings/",
            "https://www.reddit.com/r%2fAskHistorians",
        )
    private val zones = listOf("UTC", "Australia/Sydney", "Europe/London", "Pacific/Honolulu")
    private val times = listOf("00:00", "07:00", "09:00", "17:30", "22:00", "22:30")
    private val ruleIds = listOf("r-a", "r-b", "r-c", "r-d", "r-e", "r-f", "r-g", "r-h")

    /** Instants around the week of 2026-10-26 (whole seconds). */
    private val start = epochSecondsOf("2026-10-24T00:00:00Z")

    private fun <T> pick(items: List<T>): T = items[random.nextInt(items.size)]

    private fun <T> subset(
        items: List<T>,
        maxSize: Int = items.size,
        minSize: Int = 0,
    ): List<T> {
        val size = random.nextInt(minSize, maxSize + 1)
        return items.shuffled(random).take(size).sortedBy { items.indexOf(it) }
    }

    private fun <T> orNull(value: () -> T): T? = if (random.nextBoolean()) value() else null

    fun instant(): String = utcInstantOf(start + random.nextLong(9 * 86_400L + 1))

    fun target(): Target =
        when (random.nextInt(4)) {
            0 -> SiteTarget(pick(domains))
            1 -> SiteTarget(pick(domains), pick(paths))
            2 -> SurfaceTarget(pick(surfaces))
            else -> AppTarget(pick(packages))
        }

    private fun schedules(): List<RuleSchedule> =
        when (random.nextInt(3)) {
            0 -> emptyList()
            1 -> List(random.nextInt(1, 3)) { Schedule(subset(Weekday.entries, minSize = 1), pick(times), pick(times)) }
            else -> listOf(ScheduleRef.WORK_HOURS)
        }

    private fun rule(id: String): Rule {
        val mode = pick(RuleMode.entries)
        val budget = orNull { pick(listOf(1, 15, 30)) }
        return Rule(
            id = id,
            target = target(),
            mode = mode,
            schedules = schedules(),
            dailyBudgetMinutes = if (mode == RuleMode.HIDE_FEED) null else budget,
            enabled = random.nextInt(5) != 0,
        )
    }

    fun ruleset(): Ruleset =
        Ruleset(
            schemaVersion = 1,
            revision = 1,
            updatedAt = "2026-01-01T00:00:00Z",
            timeZone = pick(zones),
            pendingTimeZone = orNull { pick(zones) },
            rules = subset(ruleIds, maxSize = 6).map(::rule),
            categories =
                List(random.nextInt(4)) { CategoryAssignment(target(), pick(listOf(0, 25, 50, 75, 100)), pick(listOf("social", "video"))) }
                    .distinctBy { it.target },
            bedtime = Bedtime(random.nextBoolean(), Weekday.entries, pick(listOf("22:30", "21:00", "00:00")), "07:00", 30),
            workHours = Schedule(Weekday.entries.take(5), "09:00", "17:30"),
        )

    fun observation(): Observation =
        if (random.nextBoolean()) SiteObservation(pick(urls)) else AppObservation(pick(packages), orNull { pick(surfaces) })

    private fun escalationState(targetGroup: String): EscalationState =
        EscalationState(
            targetGroup = targetGroup,
            phase = pick(EscalationPhase.entries),
            attemptCount = random.nextInt(7),
            lastAttemptAt = orNull(::instant),
            lastActivityAt = orNull(::instant),
            brokenCount = random.nextInt(5),
            lastFrictionType = orNull { pick(FrictionType.entries) },
            gate = null,
            pauseEndsAt = orNull(::instant),
            pendingExtension = random.nextBoolean(),
            intentionExpiresAt = orNull(::instant),
            overrideReadyAt = orNull(::instant),
            overrideEndsAt = orNull(::instant),
        )

    fun decisionState(): DecisionState =
        DecisionState(
            escalation = subset(ruleIds + BEDTIME_GROUP, maxSize = 4).map(::escalationState),
            usage =
                orNull {
                    DailyUsage(
                        pick(listOf("2026-10-25", "2026-10-26", "2026-10-27")),
                        subset(ruleIds).associateWith { random.nextInt(3601) },
                    )
                },
            unlocks = List(random.nextInt(3)) { VerifiedUnlock(target(), instant(), instant()) },
            guardianLinked = random.nextBoolean(),
        )
}
