// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.ui

/** Compose test tags of the rules screen. */
object RulesTestTags {
    const val SCREEN = "rules.screen"
    const val BACK = "rules.back"
    const val MESSAGE = "rules.message"
    const val PENDING = "rules.pending"
    const val CANCEL_PENDING = "rules.pending.cancel"
    const val SUBREDDIT_FIELD = "rules.subreddit.field"
    const val SUBREDDIT_ADD = "rules.subreddit.add"
    const val BEDTIME_ENABLED = "rules.bedtime.enabled"
    const val BEDTIME_START = "rules.bedtime.start"
    const val BEDTIME_END = "rules.bedtime.end"
    const val BEDTIME_SAVE = "rules.bedtime.save"
    const val WORK_START = "rules.work.start"
    const val WORK_END = "rules.work.end"
    const val WORK_SAVE = "rules.work.save"
    const val EXPORT = "rules.export"
    const val IMPORT = "rules.import"

    fun rule(id: String): String = "rules.rule.$id"

    fun ruleEnabled(id: String): String = "rules.rule.$id.enabled"

    fun subredditRemove(name: String): String = "rules.subreddit.remove.$name"

    fun day(
        prefix: String,
        day: String,
    ): String = "$prefix.day.$day"
}
