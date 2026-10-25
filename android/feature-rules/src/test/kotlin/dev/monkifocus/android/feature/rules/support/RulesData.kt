// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.support

import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.rules.CategoryCatalog
import dev.monkifocus.android.core.domain.rules.RulesJson
import dev.monkifocus.android.core.domain.rules.SiteProfile
import dev.monkifocus.android.core.domain.rules.SurfaceRegistry
import dev.monkifocus.android.core.domain.validation.RulesetValidator
import java.io.File

/** `packages/rules` read in place (the build points `monki.rulesDir` at it): schemas and catalog data. */
object RulesData {
    private val dir = File(requireNotNull(System.getProperty("monki.rulesDir")) { "monki.rulesDir is not set" })

    fun file(relative: String): File = File(dir, relative)

    private val siteProfiles: List<SiteProfile> by lazy {
        file("data/sites")
            .listFiles { f -> f.extension == "json" }!!
            .sortedBy { it.name }
            .map { RulesJson.decodeFromString(SiteProfile.serializer(), it.readText()) }
    }

    val validator: RulesetValidator by lazy {
        val schemas =
            file("schema/v1")
                .listFiles { f -> f.name.endsWith(".schema.json") }!!
                .associate { it.name.removeSuffix(".schema.json") to it.readText() }
        RulesetValidator(schemas, siteProfiles.flatMap { profile -> profile.aliases.map { it to profile.domain } }.toMap())
    }

    val catalog: RulesCatalog by lazy {
        RulesCatalog(
            siteProfiles = siteProfiles,
            surfaces = RulesJson.decodeFromString(SurfaceRegistry.serializer(), file("data/surfaces.json").readText()).surfaces,
            defaultCategories =
                RulesJson.decodeFromString(CategoryCatalog.serializer(), file("data/categories/default.json").readText()).assignments,
        )
    }
}
