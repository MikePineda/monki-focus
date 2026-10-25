// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.support

import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.rules.CategoryCatalog
import dev.monkifocus.android.core.domain.rules.RulesJson
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.SiteProfile
import dev.monkifocus.android.core.domain.rules.SurfaceRegistry
import dev.monkifocus.android.core.domain.signing.SignatureVerifier
import dev.monkifocus.android.core.domain.validation.RulesetValidator
import dev.monkifocus.android.detectors.DetectorPack
import dev.monkifocus.android.detectors.DetectorPackLoader
import dev.monkifocus.android.detectors.Screen
import dev.monkifocus.android.detectors.XmlUiDump
import dev.monkifocus.android.service.accessibility.packs.ActivePacks
import java.io.File
import java.time.Instant

/**
 * `packages/rules` read in place (the build points `monki.rulesDir` at it):
 * schemas, catalog data, the starter preset, the bundled detector packs and
 * the sanitised synthetic UI dumps.
 */
object RulesData {
    private val dir = File(requireNotNull(System.getProperty("monki.rulesDir")) { "monki.rulesDir is not set" })

    fun file(relative: String): File = File(dir, relative)

    val schemas: Map<String, String> by lazy {
        file("schema/v1")
            .listFiles { f -> f.name.endsWith(".schema.json") }!!
            .associate { it.name.removeSuffix(".schema.json") to it.readText() }
    }

    private val siteProfiles: List<SiteProfile> by lazy {
        file("data/sites")
            .listFiles { f -> f.extension == "json" }!!
            .sortedBy { it.name }
            .map { RulesJson.decodeFromString(SiteProfile.serializer(), it.readText()) }
    }

    private val surfaces by lazy {
        RulesJson
            .decodeFromString(
                SurfaceRegistry.serializer(),
                file("data/surfaces.json").readText(),
            ).surfaces
    }

    val validator: RulesetValidator by lazy {
        RulesetValidator(schemas, siteProfiles.flatMap { profile -> profile.aliases.map { it to profile.domain } }.toMap())
    }

    val catalog: RulesCatalog by lazy {
        RulesCatalog(
            siteProfiles = siteProfiles,
            surfaces = surfaces,
            defaultCategories =
                RulesJson
                    .decodeFromString(
                        CategoryCatalog.serializer(),
                        file("data/categories/default.json").readText(),
                    ).assignments,
        )
    }

    /** No rules-signing key is pinned yet: every detached signature is refused. */
    val loader: DetectorPackLoader by lazy {
        DetectorPackLoader(validator, SignatureVerifier { _, _ -> false }, surfaces.map { it.id }.toSet())
    }

    val packIds = listOf("browsers", "instagram", "settings", "youtube")

    fun packBytes(packId: String): ByteArray = file("detectors/android/$packId.pack.json").readBytes()

    val packs: List<DetectorPack> by lazy {
        ActivePacks(loader).load(packIds.associateWith(::packBytes), emptyMap(), Instant.parse("2026-11-01T00:00:00Z"))
    }

    val starter: Ruleset by lazy { RulesJson.decodeFromString(Ruleset.serializer(), file("data/presets/starter.ruleset.json").readText()) }

    /** The screen of a synthetic dump; the package is the directory it sits in. */
    fun screen(relative: String): Screen {
        val dump = file("fixtures/detectors/android/$relative").inputStream().use { XmlUiDump.parse(it) }
        return Screen.of(dump.root, relative.substringBefore('/'))
    }
}
