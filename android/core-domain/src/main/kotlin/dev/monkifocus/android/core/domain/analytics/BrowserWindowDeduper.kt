// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.engine.utcInstantOf

/*
 * Browser dedupe on one device (SEMANTICS.md §10.8). Web events become `web`
 * segments with their domain, never clipped to browser window time; other
 * window events stay `app` segments. Browser window time minus the union of
 * web events is uncovered. The extension's known heartbeats are the end of
 * every web event and `extensionLastHeartbeatAt`; an uncovered instant `t`
 * is `browser-unknown` when the latest heartbeat `h ≤ t` has
 * `t < h + staleAfterSeconds`, otherwise (a silent extension, or no
 * heartbeat yet) it counts as the browser app itself.
 */

/** `activity-fixture.schema.json` `BrowserDedupeGiven`. */
data class BrowserDedupeInput(
    val browserApps: List<String>,
    val windowEvents: List<ActivityEvent>,
    val webEvents: List<ActivityEvent>,
    val extensionLastHeartbeatAt: String?,
    val staleAfterSeconds: Long,
)

/** Activity key of browser time the live extension did not explain. */
const val BROWSER_UNKNOWN = "browser-unknown"

private data class Piece(
    val start: Long,
    val end: Long,
    val source: ActivitySource,
    val activityKey: String,
)

private val PIECE_ORDER: Comparator<Piece> =
    compareBy<Piece> { it.start }.thenBy { it.end }.thenBy { it.source.code }.thenBy { it.activityKey }

/** Splits an uncovered stretch where its latest heartbeat or its staleness changes, labels each part, and joins equal neighbours. */
private fun attributeGap(
    gap: Interval,
    app: String,
    heartbeats: List<Long>,
    staleAfterSeconds: Long,
): List<Piece> {
    val cuts =
        heartbeats
            .flatMap { listOf(it, it + staleAfterSeconds) }
            .filter { it > gap.start && it < gap.end }
    val ends = (cuts + gap.end).distinct().sorted()
    val pieces = mutableListOf<Piece>()
    var start = gap.start
    for (end in ends) {
        // Heartbeats are sorted, so the last one at or before `start` is the latest.
        val latest = heartbeats.lastOrNull { it <= start }
        val live = latest != null && start < latest + staleAfterSeconds
        val activityKey = if (live) BROWSER_UNKNOWN else app
        val last = pieces.lastOrNull()
        if (last?.activityKey == activityKey) {
            pieces[pieces.lastIndex] = last.copy(end = end)
        } else {
            pieces += Piece(start, end, ActivitySource.APP, activityKey)
        }
        start = end
    }
    return pieces
}

fun dedupeBrowserTime(input: BrowserDedupeInput): List<AttributedSegment> {
    val browsers = input.browserApps.toSet()
    val covered =
        input.webEvents.mapNotNull { event ->
            val data = event.data as? EventData.WebTab ?: return@mapNotNull null
            val interval = intervalOf(event)
            Piece(interval.start, interval.end, ActivitySource.WEB, data.domain)
        }
    val coveredIntervals = covered.map { Interval(it.start, it.end) }
    val lastHeartbeat = listOfNotNull(input.extensionLastHeartbeatAt?.let(::epochSecondsOf))
    val heartbeats = (covered.map { it.end } + lastHeartbeat).sorted()

    val pieces = covered.toMutableList()
    for (event in input.windowEvents) {
        val app = (event.data as? EventData.Window)?.app ?: continue
        val interval = intervalOf(event)
        if (app !in browsers) {
            pieces += Piece(interval.start, interval.end, ActivitySource.APP, app)
            continue
        }
        for (gap in subtractIntervals(listOf(interval), coveredIntervals)) {
            pieces += attributeGap(gap, app, heartbeats, input.staleAfterSeconds)
        }
    }
    return pieces
        .filter { it.end > it.start }
        .sortedWith(PIECE_ORDER)
        .map { AttributedSegment(utcInstantOf(it.start), utcInstantOf(it.end), it.source, it.activityKey) }
}
