// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.engine.normalizeUrl
import dev.monkifocus.android.core.domain.engine.utcInstantOf
import dev.monkifocus.android.core.domain.rules.NormalizedUrl

/*
 * Browser tab sampling (SEMANTICS.md §10.2). The adapter reads the browser
 * state; this function decides whether it is a heartbeat and what it holds.
 * The URL goes through the engine's `normalizeUrl` (§2): never the query or
 * the fragment; the title only when the user opted in.
 */

/** A zero-length heartbeat at `now`, or null when nothing must be counted. */
fun probeTab(
    input: TabProbeInput,
    catalog: RulesCatalog,
): ActivityEvent? {
    val tab = input.tab
    if (!input.windowFocused || input.idleState == TabProbeInput.IdleState.LOCKED || tab == null) return null
    val countsWhileIdle = tab.audible && input.settings.countAudibleWhileIdle
    if (input.idleState == TabProbeInput.IdleState.IDLE && !countsWhileIdle) return null

    val url = normalizeUrl(tab.url, catalog) as? NormalizedUrl ?: return null
    val data =
        EventData.WebTab(
            domain = url.host,
            path = url.path,
            surface = url.surface,
            audible = tab.audible,
            incognito = tab.incognito,
            title = if (input.settings.storeTitles) tab.title else null,
        )
    return ActivityEvent(timestamp = utcInstantOf(epochSecondsOf(input.now)), duration = 0, data = data)
}
