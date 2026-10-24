// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.fixtures

import dev.monkifocus.android.core.domain.validation.RulesetValidator
import dev.monkifocus.android.core.domain.validation.ValidationResult
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File

/** One fixture file: its id, raw text and parsed JSON. */
data class Fixture(
    val id: String,
    val text: String,
    val json: JsonObject,
)

/**
 * Reads the fixtures of a kind by relative path (SEMANTICS.md §12): every file
 * is validated against `schema/v1/fixture.schema.json` (including the `x-*`
 * keywords), must carry its directory's kind and be named after its id. An
 * unknown kind, an invalid shape or a misfiled fixture throws: nothing is
 * skipped.
 */
object FixtureLoader {
    /** Every kind `fixture.schema.json` declares. */
    val declaredKinds: List<String> by lazy {
        val schema = Json.parseToJsonElement(RulesPackage.schemas.getValue("fixture")).jsonObject
        val kinds =
            schema
                .getValue("properties")
                .jsonObject
                .getValue("kind")
                .jsonObject
                .getValue("enum")
        (kinds as kotlinx.serialization.json.JsonArray).map { it.jsonPrimitive.content }
    }

    fun load(
        kind: String,
        root: File = RulesPackage.directory("fixtures"),
        validator: RulesetValidator = RulesPackage.validator,
    ): List<Fixture> {
        require(kind in declaredKinds) { "Unknown fixture kind: $kind" }
        val directory = File(root, kind)
        require(directory.isDirectory) { "No fixtures directory for kind $kind" }
        return directory
            .listFiles { file -> file.isFile }!!
            .map { file -> parse(kind, file, validator) }
            .sortedBy { it.id }
    }

    private fun parse(
        kind: String,
        file: File,
        validator: RulesetValidator,
    ): Fixture {
        val relative = "${file.parentFile.name}/${file.name}"
        require(file.extension == "json") { "$relative is not a .json fixture" }
        val text = file.readText()
        val result = validator.validateDocument("fixture", text)
        require(result is ValidationResult.Valid) { "$relative is not a valid fixture: $result" }
        val json = Json.parseToJsonElement(text).jsonObject
        val id = json.getValue("id").jsonPrimitive.content
        val fileKind = json.getValue("kind").jsonPrimitive.content
        require(fileKind == kind) { "$relative has kind $fileKind but sits in the $kind directory" }
        val expectedName = id.substringAfter('.') + ".json"
        require(file.name == expectedName) { "$relative must be named $expectedName after its id" }
        return Fixture(id, text, json)
    }

    /** JUnit4 `Parameterized` data: `{0}` is the fixture id, the test name in every runner. */
    fun parameters(vararg kinds: String): List<Array<Any>> = kinds.flatMap { load(it) }.map { arrayOf(it.id, it) }
}
