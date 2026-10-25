// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.content.res.AssetManager
import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.engine.isResolvableTimeZone
import dev.monkifocus.android.core.domain.rules.CategoryCatalog
import dev.monkifocus.android.core.domain.rules.RulesJson
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.SiteProfile
import dev.monkifocus.android.core.domain.rules.SurfaceRegistry
import dev.monkifocus.android.core.domain.validation.RulesetValidator
import dev.monkifocus.android.core.domain.validation.ValidationResult
import java.time.ZoneId

/**
 * The `packages/rules` data the build copies into the APK's assets
 * (`rules/schema/v1`, `rules/data`, `rules/detectors/android`): schemas for
 * the validator, the catalog the engine needs, the starter preset and the
 * bundled detector packs. Everything is read lazily, off the main thread.
 */
class BundledRules(
    private val assets: AssetManager,
) {
    private fun text(path: String): String = assets.open("$ROOT/$path").use { it.readBytes().toString(Charsets.UTF_8) }

    private fun list(path: String): List<String> = assets.list("$ROOT/$path").orEmpty().sorted()

    private val siteProfiles: List<SiteProfile> by lazy {
        list("data/sites").filter { it.endsWith(JSON) }.map { RulesJson.decodeFromString(SiteProfile.serializer(), text("data/sites/$it")) }
    }

    val surfaces by lazy { RulesJson.decodeFromString(SurfaceRegistry.serializer(), text("data/surfaces.json")).surfaces }

    val validator: RulesetValidator by lazy {
        val schemas =
            list("schema/v1").filter { it.endsWith(SCHEMA_SUFFIX) }.associate {
                it.removeSuffix(SCHEMA_SUFFIX) to
                    text("schema/v1/$it")
            }
        RulesetValidator(schemas, siteProfiles.flatMap { profile -> profile.aliases.map { it to profile.domain } }.toMap())
    }

    val catalog: RulesCatalog by lazy {
        RulesCatalog(
            siteProfiles = siteProfiles,
            surfaces = surfaces,
            defaultCategories = RulesJson.decodeFromString(CategoryCatalog.serializer(), text("data/categories/default.json")).assignments,
        )
    }

    /**
     * The starter preset, validated, in the device's time zone: the rule set
     * in force until onboarding commits the user's own (SEMANTICS.md §6.3,
     * "clients set the device zone once at install").
     */
    val starter: Ruleset by lazy {
        val raw = text("data/presets/starter.ruleset.json")
        check(validator.validateDocument("ruleset", raw) is ValidationResult.Valid) { "bundled starter preset is invalid" }
        val zone = ZoneId.systemDefault().id
        RulesJson.decodeFromString(Ruleset.serializer(), raw).let { if (isResolvableTimeZone(zone)) it.copy(timeZone = zone) else it }
    }

    /** Pack id → bytes of every bundled detector pack. */
    fun packs(): Map<String, ByteArray> =
        list("detectors/android")
            .filter { it.endsWith(PACK_SUFFIX) }
            .associate { it.removeSuffix(PACK_SUFFIX) to assets.open("$ROOT/detectors/android/$it").use { stream -> stream.readBytes() } }

    private companion object {
        const val ROOT = "rules"
        const val JSON = ".json"
        const val SCHEMA_SUFFIX = ".schema.json"
        const val PACK_SUFFIX = ".pack.json"
    }
}
