// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.ingest

import dev.monkifocus.android.core.domain.analytics.ActivityEvent
import dev.monkifocus.android.core.domain.analytics.ActivitySource
import dev.monkifocus.android.core.domain.analytics.AttributedEvent
import dev.monkifocus.android.core.domain.analytics.BrowserDedupeInput
import dev.monkifocus.android.core.domain.analytics.CategorisableActivity
import dev.monkifocus.android.core.domain.analytics.EventData
import dev.monkifocus.android.core.domain.analytics.Interval
import dev.monkifocus.android.core.domain.analytics.activeTime
import dev.monkifocus.android.core.domain.analytics.categorise
import dev.monkifocus.android.core.domain.analytics.dedupeBrowserTime
import dev.monkifocus.android.core.domain.analytics.subtractIntervals
import dev.monkifocus.android.core.domain.analytics.unionIntervals
import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.engine.utcInstantOf
import dev.monkifocus.android.core.domain.rules.CategoryAssignment

/**
 * The device's raw events as attributed time (SEMANTICS.md §9, §10.3,
 * §10.8). Pure.
 *
 * 1. Window and web events are cut to active time against the `afk`
 *    periods (the analytics core's `activeTime`).
 * 2. Web events (the accessibility service's URL-bar heartbeats) are clipped
 *    to the browsers' foreground time: on a phone a page only counts while
 *    its browser is in front, so a heartbeat merged across a quick app switch
 *    never counts twice.
 * 3. Browser window time goes through `dedupeBrowserTime`: time a web event
 *    covers is the site's, uncovered time is `browser-unknown` for
 *    [STALE_AFTER_SECONDS] after the last page seen, then the browser itself.
 * 4. Each piece is categorised: sites by domain, path and surface (`web`),
 *    apps by package (`android`). Titles and URLs are never read.
 */
object UsageAttribution {
    /** How long after the last URL-bar reading uncovered browser time still counts as an unknown page. */
    const val STALE_AFTER_SECONDS = 180L

    fun attribute(
        windowEvents: List<ActivityEvent>,
        afkEvents: List<ActivityEvent>,
        webEvents: List<ActivityEvent>,
        browserApps: Set<String>,
        categories: List<CategoryAssignment>,
        catalog: RulesCatalog,
    ): List<AttributedEvent> {
        val activeWindow = activeTime(windowEvents, afkEvents)
        val browserTime =
            unionIntervals(
                activeWindow.filter { (it.data as? EventData.Window)?.app in browserApps }.map(::intervalOf),
            )
        val activeWeb = activeTime(webEvents, afkEvents).flatMap { clipTo(it, browserTime) }

        val segments =
            dedupeBrowserTime(
                BrowserDedupeInput(
                    browserApps = browserApps.sorted(),
                    windowEvents = activeWindow,
                    webEvents = activeWeb,
                    extensionLastHeartbeatAt = null,
                    staleAfterSeconds = STALE_AFTER_SECONDS,
                ),
            )
        val apps =
            segments
                .filter { it.source == ActivitySource.APP }
                .map { segment ->
                    val start = epochSecondsOf(segment.start)
                    val match =
                        categorise(CategorisableActivity(ActivitySource.ANDROID, segment.activityKey, null, null), categories, catalog)
                    AttributedEvent(
                        timestamp = segment.start,
                        duration = (epochSecondsOf(segment.end) - start).toInt(),
                        source = ActivitySource.ANDROID,
                        activityKey = segment.activityKey,
                        categoryPath = match.categoryPath,
                        level = match.level,
                    )
                }
        val sites =
            activeWeb.mapNotNull { event ->
                val data = event.data as? EventData.WebTab ?: return@mapNotNull null
                val match = categorise(CategorisableActivity(ActivitySource.WEB, data.domain, data.path, data.surface), categories, catalog)
                AttributedEvent(
                    timestamp = event.timestamp,
                    duration = event.duration,
                    source = ActivitySource.WEB,
                    activityKey = data.domain,
                    categoryPath = match.categoryPath,
                    level = match.level,
                )
            }
        // A key a block would reject (never expected from packages or normalised hosts) is dropped, not thrown.
        val kept = (apps + sites).filter { ACCEPTED_ACTIVITY.matches(it.activityKey) && it.duration > 0 }
        return kept.sortedBy { epochSecondsOf(it.timestamp) }
    }

    private val ACCEPTED_ACTIVITY = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$")

    private fun intervalOf(event: ActivityEvent): Interval {
        val start = epochSecondsOf(event.timestamp)
        return Interval(start, start + event.duration)
    }

    /** The parts of [event] inside [allowed] (sorted, disjoint), with the same data. */
    private fun clipTo(
        event: ActivityEvent,
        allowed: List<Interval>,
    ): List<ActivityEvent> {
        val whole = listOf(intervalOf(event))
        val outside = subtractIntervals(whole, allowed)
        return subtractIntervals(whole, outside).map { piece ->
            ActivityEvent(utcInstantOf(piece.start), (piece.end - piece.start).toInt(), event.data)
        }
    }
}
