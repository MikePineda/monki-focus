// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.fakes

import dev.monkifocus.android.core.domain.analytics.ActivityEvent
import dev.monkifocus.android.core.domain.analytics.EventData
import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.engine.utcInstantOf
import dev.monkifocus.android.core.domain.rules.AppTarget
import dev.monkifocus.android.core.domain.rules.CategoryAssignment
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.core.domain.usage.DeviceUsageEvent
import dev.monkifocus.android.core.domain.usage.UsageEventKind
import java.time.Instant

/** Synthetic analytics inputs: generic packages and example domains only. */
object AnalyticsTestData {
    /** 2026-10-25T08:00:00Z, aligned to a block. */
    val T0: Long = Instant.parse("2026-10-25T08:00:00Z").toEpochMilli()

    const val MINUTE = 60_000L

    const val SOCIAL_APP = "com.example.social"
    const val NOTES_APP = "com.example.notes"
    const val BROWSER = "com.example.browser"

    /** Defaults like the bundled catalog's: one distracting app, one focus app, one distracting site. */
    val catalog =
        RulesCatalog(
            siteProfiles = emptyList(),
            surfaces = emptyList(),
            defaultCategories =
                listOf(
                    CategoryAssignment(AppTarget(SOCIAL_APP), 0, "social"),
                    CategoryAssignment(AppTarget(NOTES_APP), 100, "work"),
                    CategoryAssignment(SiteTarget("video.example"), 0, "video"),
                ),
        )

    fun resumed(
        at: Long,
        pkg: String,
    ) = DeviceUsageEvent(UsageEventKind.ACTIVITY_RESUMED, at, pkg)

    fun paused(
        at: Long,
        pkg: String,
    ) = DeviceUsageEvent(UsageEventKind.ACTIVITY_PAUSED, at, pkg)

    fun screenOff(at: Long) = DeviceUsageEvent(UsageEventKind.SCREEN_NON_INTERACTIVE, at, null)

    fun screenOn(at: Long) = DeviceUsageEvent(UsageEventKind.SCREEN_INTERACTIVE, at, null)

    fun window(
        startMillis: Long,
        minutes: Int,
        app: String,
    ) = ActivityEvent(utcInstantOf(startMillis / 1_000), minutes * 60, EventData.Window(app))

    fun web(
        startMillis: Long,
        seconds: Int,
        domain: String,
        path: String = "/",
    ) = ActivityEvent(utcInstantOf(startMillis / 1_000), seconds, EventData.WebTab(domain, path, null, audible = false, incognito = false))
}
