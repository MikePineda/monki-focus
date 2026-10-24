// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.rules.CategoryCatalog
import dev.monkifocus.android.core.domain.rules.RulesJson
import dev.monkifocus.android.core.domain.rules.SiteProfile
import dev.monkifocus.android.core.domain.rules.SurfaceRegistry
import dev.monkifocus.android.core.domain.signing.SignatureVerifier
import dev.monkifocus.android.core.domain.validation.RulesetValidator
import java.io.File

/**
 * `packages/rules` as the test classpath sees it (the build adds `schema/`,
 * `data/`, `detectors/` and `fixtures/detectors/` in place), plus the bundled
 * packs loaded through the real loader.
 */
object RulesResources {
    fun file(relative: String): File {
        val url = requireNotNull(javaClass.getResource("/$relative")) { "packages/rules/$relative is not on the test classpath" }
        return File(url.toURI())
    }

    val schemas: Map<String, String> by lazy {
        file("schema/v1")
            .listFiles { f -> f.name.endsWith(".schema.json") }!!
            .associate { it.name.removeSuffix(".schema.json") to it.readText() }
    }

    val validator: RulesetValidator by lazy { RulesetValidator(schemas, aliases = emptyMap()) }

    /** The surface ids of `data/surfaces.json`. */
    val registeredSurfaces: Set<String> by lazy {
        RulesJson
            .decodeFromString(SurfaceRegistry.serializer(), file("data/surfaces.json").readText())
            .surfaces
            .map { it.id }
            .toSet()
    }

    /** Bundled packs need no signature; a verifier that is never asked is enough. */
    val bundledLoader: DetectorPackLoader by lazy {
        DetectorPackLoader(validator, SignatureVerifier { _, _ -> error("bundled packs are not signature-checked") }, registeredSurfaces)
    }

    fun packBytes(packId: String): ByteArray = file("detectors/android/$packId.pack.json").readBytes()

    fun bundledPack(packId: String): DetectorPack =
        when (val result = bundledLoader.loadBundled(packBytes(packId))) {
            is PackLoadResult.Accepted -> result.pack
            is PackLoadResult.Rejected -> error("bundled pack $packId rejected: ${result.reason}")
        }

    val bundledPacks: List<DetectorPack> by lazy { listOf("instagram", "youtube", "browsers", "settings").map(::bundledPack) }

    val catalog: RulesCatalog by lazy {
        RulesCatalog(
            siteProfiles =
                file("data/sites")
                    .listFiles { f -> f.extension == "json" }!!
                    .sortedBy { it.name }
                    .map { RulesJson.decodeFromString(SiteProfile.serializer(), it.readText()) },
            surfaces = RulesJson.decodeFromString(SurfaceRegistry.serializer(), file("data/surfaces.json").readText()).surfaces,
            defaultCategories =
                RulesJson.decodeFromString(CategoryCatalog.serializer(), file("data/categories/default.json").readText()).assignments,
        )
    }

    /** Every sanitised dump under `fixtures/detectors/android/<package>/<version>/`. */
    val dumps: List<File> by lazy {
        file("fixtures/detectors/android")
            .walkTopDown()
            .filter { it.isFile && it.extension == "xml" }
            .sortedBy { it.path }
            .toList()
    }

    fun dumpName(dump: File): String = dump.relativeTo(file("fixtures/detectors/android")).invariantSeparatorsPath

    fun dump(relative: String): XmlUiDump = file("fixtures/detectors/android/$relative").inputStream().use { XmlUiDump.parse(it) }

    /** The screen of a dump; the package is the directory the dump sits in. */
    fun screen(relative: String): Screen = Screen.of(dump(relative).root, relative.substringBefore('/'))
}
