// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.domain.rules.AppTarget
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.core.domain.rules.SurfaceTarget
import dev.monkifocus.android.core.domain.rules.Target
import dev.monkifocus.android.core.domain.rules.Weekday
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.rememberLocalDateTimeText
import dev.monkifocus.android.feature.rules.change.RuleChangeRejection
import dev.monkifocus.android.feature.rules.change.RulesMessage
import dev.monkifocus.android.feature.rules.edit.PendingChange
import dev.monkifocus.android.feature.rules.edit.ScheduleSummary

/** Catalog copy for the rules screen's domain values: modes, schedules, targets, outcomes. */
internal object RulesText {
    val MODES: List<RuleMode> = listOf(RuleMode.ALLOW, RuleMode.HIDE_FEED, RuleMode.FRICTION, RuleMode.BLOCK)

    fun mode(mode: RuleMode): Int =
        when (mode) {
            RuleMode.ALLOW -> R.string.rules_mode_allow
            RuleMode.HIDE_FEED -> R.string.rules_mode_hide_feed
            RuleMode.FRICTION -> R.string.rules_mode_friction
            RuleMode.BLOCK -> R.string.rules_mode_block
        }

    fun day(day: Weekday): Int =
        when (day) {
            Weekday.MON -> R.string.day_mon
            Weekday.TUE -> R.string.day_tue
            Weekday.WED -> R.string.day_wed
            Weekday.THU -> R.string.day_thu
            Weekday.FRI -> R.string.day_fri
            Weekday.SAT -> R.string.day_sat
            Weekday.SUN -> R.string.day_sun
        }

    fun rejection(code: RuleChangeRejection): Int =
        when (code) {
            RuleChangeRejection.SCHEMA -> R.string.rules_rejected_schema
            RuleChangeRejection.DUPLICATE_KEY -> R.string.rules_rejected_duplicate_key
            RuleChangeRejection.INVALID_DOMAIN -> R.string.rules_rejected_invalid_domain
            RuleChangeRejection.INVALID_TIME_ZONE -> R.string.rules_rejected_invalid_time_zone
            RuleChangeRejection.TOO_LARGE -> R.string.rules_rejected_too_large
            RuleChangeRejection.INVALID_JSON -> R.string.rules_rejected_invalid_json
            RuleChangeRejection.STALE_REVISION -> R.string.rules_rejected_stale_revision
            RuleChangeRejection.TOO_MANY_RULES -> R.string.rules_rejected_too_many_rules
            RuleChangeRejection.INVALID_RULESET -> R.string.rules_rejected_invalid_ruleset
            RuleChangeRejection.ZONE_CHANGE_PENDING -> R.string.rules_rejected_zone_change_pending
        }

    /** A surface id of `data/surfaces.json` by its name in the catalog; an unknown one is shown as its id. */
    private val SURFACES: Map<String, Int> =
        mapOf(
            "instagram.home" to R.string.surface_instagram_home,
            "instagram.reels" to R.string.surface_instagram_reels,
            "instagram.explore" to R.string.surface_instagram_explore,
            "instagram.reel_from_dm" to R.string.surface_instagram_reel_from_dm,
            "instagram.reel_permalink" to R.string.surface_instagram_reel_permalink,
            "instagram.post" to R.string.surface_instagram_post,
            "instagram.stories" to R.string.surface_instagram_stories,
            "instagram.direct" to R.string.surface_instagram_direct,
            "instagram.search" to R.string.surface_instagram_search,
            "reddit.feed" to R.string.surface_reddit_feed,
            "reddit.user_feed" to R.string.surface_reddit_user_feed,
            "reddit.permalink" to R.string.surface_reddit_permalink,
            "reddit.search" to R.string.surface_reddit_search,
            "reddit.messages" to R.string.surface_reddit_messages,
            "x.home" to R.string.surface_x_home,
            "x.explore" to R.string.surface_x_explore,
            "x.status" to R.string.surface_x_status,
            "x.search" to R.string.surface_x_search,
            "x.messages" to R.string.surface_x_messages,
            "youtube.home" to R.string.surface_youtube_home,
            "youtube.subscriptions" to R.string.surface_youtube_subscriptions,
            "youtube.explore" to R.string.surface_youtube_explore,
            "youtube.shorts" to R.string.surface_youtube_shorts,
            "youtube.watch" to R.string.surface_youtube_watch,
            "youtube.search" to R.string.surface_youtube_search,
            "youtube.library" to R.string.surface_youtube_library,
        )

    @Composable
    fun target(target: Target): String =
        when (target) {
            is SiteTarget -> target.domain + target.path.orEmpty()
            is AppTarget -> stringResource(R.string.rules_target_app, target.packageName)
            is SurfaceTarget -> SURFACES[target.surface]?.let { stringResource(it) } ?: target.surface
        }

    @Composable
    fun schedule(schedule: ScheduleSummary): String =
        when (schedule) {
            ScheduleSummary.Always -> {
                stringResource(R.string.rules_schedule_always)
            }

            ScheduleSummary.WorkHours -> {
                stringResource(R.string.rules_schedule_work_hours)
            }

            is ScheduleSummary.Windows -> {
                if (schedule.withWorkHours) {
                    stringResource(R.string.rules_schedule_windows_work, schedule.windows)
                } else {
                    stringResource(R.string.rules_schedule_windows, schedule.windows)
                }
            }
        }

    @Composable
    fun pendingChange(change: PendingChange): String =
        when (change) {
            is PendingChange.RuleAdded -> stringResource(R.string.rules_pending_rule_added, target(change.target))
            is PendingChange.RuleChanged -> stringResource(R.string.rules_pending_rule_changed, target(change.target))
            is PendingChange.RuleRemoved -> stringResource(R.string.rules_pending_rule_removed, target(change.target))
            PendingChange.BedtimeChanged -> stringResource(R.string.rules_pending_bedtime)
            PendingChange.WorkHoursChanged -> stringResource(R.string.rules_pending_work_hours)
            PendingChange.CategoriesChanged -> stringResource(R.string.rules_pending_categories)
            PendingChange.TimeZoneChanged -> stringResource(R.string.rules_pending_time_zone)
        }

    @Composable
    fun message(message: RulesMessage): String =
        when (message) {
            RulesMessage.Saved -> {
                stringResource(R.string.rules_saved)
            }

            is RulesMessage.SavedPending -> {
                stringResource(R.string.rules_saved_pending, rememberLocalDateTimeText(message.effectiveFrom))
            }

            RulesMessage.Cancelled -> {
                stringResource(R.string.rules_cancelled)
            }

            is RulesMessage.Rejected -> {
                stringResource(rejection(message.code))
            }

            is RulesMessage.ImportInvalid -> {
                val reason = stringResource(rejection(RuleChangeRejection.of(message.code)))
                val location = message.location
                if (location == null) {
                    stringResource(R.string.rules_import_invalid, reason)
                } else {
                    stringResource(R.string.rules_import_invalid_at, reason, location)
                }
            }

            RulesMessage.Exported -> {
                stringResource(R.string.rules_exported)
            }

            RulesMessage.FileFailed -> {
                stringResource(R.string.rules_file_failed)
            }
        }
}
