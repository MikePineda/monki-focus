// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.edit

import dev.monkifocus.android.core.domain.rules.Bedtime
import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.Schedule
import dev.monkifocus.android.core.domain.rules.SiteTarget

/**
 * Pure edits of a rule set, as the rules screen makes them (the twin of the
 * extension's `RulesetEdits.ts`). Each returns a new rule set; the
 * `RuleChangeService` judges it (tighten now, loosen later) and assigns the
 * revision.
 */
object RulesetEdits {
    /** The domain a reddit community rule targets (aliases and `www.` are normalised by the engine). */
    const val REDDIT_DOMAIN = "reddit.com"

    private val SUBREDDIT_PATH = Regex("""^/r/([A-Za-z0-9_]{2,21})/\*\*$""")

    fun setEnabled(
        ruleset: Ruleset,
        id: String,
        enabled: Boolean,
    ): Ruleset = update(ruleset, id) { it.copy(enabled = enabled) }

    fun setMode(
        ruleset: Ruleset,
        id: String,
        mode: RuleMode,
    ): Ruleset = update(ruleset, id) { it.copy(mode = mode) }

    fun removeRule(
        ruleset: Ruleset,
        id: String,
    ): Ruleset = ruleset.copy(rules = ruleset.rules.filterNot { it.id == id })

    fun setBedtime(
        ruleset: Ruleset,
        bedtime: Bedtime,
    ): Ruleset = ruleset.copy(bedtime = bedtime)

    fun setWorkHours(
        ruleset: Ruleset,
        workHours: Schedule,
    ): Ruleset = ruleset.copy(workHours = workHours)

    /** The subreddit an `allow` rule lets through, or null for any other rule. */
    fun allowedSubredditOf(rule: Rule): String? {
        val target = rule.target as? SiteTarget ?: return null
        if (rule.mode != RuleMode.ALLOW || bareDomain(target.domain) != REDDIT_DOMAIN) return null
        return SUBREDDIT_PATH.matchEntire(target.path.orEmpty())?.groupValues?.get(1)
    }

    /** The allowed communities of the set, in rule order, with the rule that allows each. */
    fun allowedSubreddits(ruleset: Ruleset): List<Pair<Rule, String>> =
        ruleset.rules.mapNotNull { rule -> allowedSubredditOf(rule)?.let { rule to it } }

    /** Adds an always-on `allow` rule on `reddit.com/r/<name>/` and below (no-op when it exists, whatever its case). */
    fun allowSubreddit(
        ruleset: Ruleset,
        name: String,
    ): Ruleset {
        if (allowedSubreddits(ruleset).any { (_, existing) -> existing.equals(name, ignoreCase = true) }) return ruleset
        val rule =
            Rule(
                id = uniqueId(ruleset, "allow-reddit-r-${slug(name)}"),
                target = SiteTarget(REDDIT_DOMAIN, "/r/$name/**"),
                mode = RuleMode.ALLOW,
                schedules = emptyList(),
                enabled = true,
            )
        return ruleset.copy(rules = ruleset.rules + rule)
    }

    private fun update(
        ruleset: Ruleset,
        id: String,
        change: (Rule) -> Rule,
    ): Ruleset = ruleset.copy(rules = ruleset.rules.map { if (it.id == id) change(it) else it })

    private fun bareDomain(domain: String): String =
        domain
            .lowercase()
            .removePrefix("www.")
            .removePrefix("old.")
            .removePrefix("m.")

    private fun slug(text: String): String = text.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')

    private fun uniqueId(
        ruleset: Ruleset,
        base: String,
    ): String {
        val taken = ruleset.rules.map { it.id }.toSet()
        if (base !in taken) return base
        return generateSequence(2) { it + 1 }.map { "$base-$it" }.first { it !in taken }
    }
}
