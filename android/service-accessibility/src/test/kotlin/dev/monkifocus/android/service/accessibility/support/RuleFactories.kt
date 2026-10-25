// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.support

import dev.monkifocus.android.core.domain.rules.AppTarget
import dev.monkifocus.android.core.domain.rules.Bedtime
import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.core.domain.rules.SurfaceTarget
import dev.monkifocus.android.core.domain.rules.Target
import dev.monkifocus.android.core.domain.rules.Weekday

/** Synthetic rules for the service tests. 2026-01-05 is a Monday; the zone is UTC. */
internal const val INSTAGRAM = "com.instagram.android"
internal const val YOUTUBE = "com.google.android.youtube"
internal const val CHROME = "com.android.chrome"
internal const val SETTINGS = "com.android.settings"
internal const val OURS = "dev.monkifocus.android"

/** 2026-01-05T09:00:00Z, a Monday morning outside bedtime. */
internal const val MORNING_MS = 1_767_603_600_000L

/** 2026-01-05T23:00:00Z, inside a 22:30–07:00 bedtime. */
internal const val NIGHT_MS = 1_767_654_000_000L

internal fun surface(id: String): Target = SurfaceTarget(id)

internal fun site(domain: String): Target = SiteTarget(domain)

internal fun app(packageName: String): Target = AppTarget(packageName)

internal fun aRule(
    id: String,
    target: Target,
    mode: RuleMode,
) = Rule(id = id, target = target, mode = mode, schedules = emptyList(), enabled = true)

internal val BEDTIME_OFF = Bedtime(enabled = false, days = Weekday.entries, start = "22:30", end = "07:00", warnMinutesBefore = 30)

internal val BEDTIME_ON = BEDTIME_OFF.copy(enabled = true)

internal fun aRuleset(
    vararg rules: Rule,
    bedtime: Bedtime = BEDTIME_OFF,
): Ruleset = RulesData.starter.copy(rules = rules.toList(), bedtime = bedtime, timeZone = "UTC", categories = emptyList())
