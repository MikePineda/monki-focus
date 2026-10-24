// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.fixtures

import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.rules.CategoryCatalog
import dev.monkifocus.android.core.domain.rules.RulesJson
import dev.monkifocus.android.core.domain.rules.SiteProfile
import dev.monkifocus.android.core.domain.rules.SurfaceRegistry
import dev.monkifocus.android.core.domain.validation.RulesetValidator
import java.io.File

/**
 * `packages/rules` as the test classpath sees it: the build adds its
 * `schema/`, `data/` and `fixtures/` directories to the test resources in
 * place (nothing is copied into this module's sources).
 */
object RulesPackage {
    fun directory(relative: String): File {
        val url = requireNotNull(javaClass.getResource("/$relative")) { "packages/rules/$relative is not on the test classpath" }
        return File(url.toURI())
    }

    fun text(relative: String): String = File(directory(relative.substringBeforeLast('/')), relative.substringAfterLast('/')).readText()

    /** Schema name (file name without `.schema.json`) → schema text. */
    val schemas: Map<String, String> by lazy {
        directory("schema/v1")
            .listFiles { file -> file.name.endsWith(".schema.json") }!!
            .sortedBy { it.name }
            .associate { it.name.removeSuffix(".schema.json") to it.readText() }
    }

    val siteProfiles: List<SiteProfile> by lazy {
        directory("data/sites")
            .listFiles { file -> file.extension == "json" }!!
            .sortedBy { it.name }
            .map { RulesJson.decodeFromString(SiteProfile.serializer(), it.readText()) }
    }

    /** Alias → canonical domain of the site profiles, in profile order. */
    val aliases: Map<String, String> by lazy {
        LinkedHashMap<String, String>().apply { siteProfiles.forEach { profile -> profile.aliases.forEach { put(it, profile.domain) } } }
    }

    val catalog: RulesCatalog by lazy {
        RulesCatalog(
            siteProfiles = siteProfiles,
            surfaces = RulesJson.decodeFromString(SurfaceRegistry.serializer(), text("data/surfaces.json")).surfaces,
            defaultCategories = RulesJson.decodeFromString(CategoryCatalog.serializer(), text("data/categories/default.json")).assignments,
        )
    }

    val validator: RulesetValidator by lazy { RulesetValidator(schemas, aliases) }
}
