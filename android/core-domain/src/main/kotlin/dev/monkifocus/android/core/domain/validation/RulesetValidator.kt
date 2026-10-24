// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.validation

import com.fasterxml.jackson.core.JacksonException
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.networknt.schema.Error
import com.networknt.schema.ExecutionContext
import com.networknt.schema.Schema
import com.networknt.schema.SchemaContext
import com.networknt.schema.SchemaLocation
import com.networknt.schema.SchemaRegistry
import com.networknt.schema.SchemaRegistryConfig
import com.networknt.schema.dialect.Dialect
import com.networknt.schema.dialect.Draft202012
import com.networknt.schema.keyword.AbstractKeyword
import com.networknt.schema.keyword.BaseKeywordValidator
import com.networknt.schema.keyword.KeywordValidator
import com.networknt.schema.path.NodePath
import dev.monkifocus.android.core.domain.engine.isResolvableTimeZone
import java.util.concurrent.ConcurrentHashMap

/**
 * Validates rules documents (rule sets, site profiles, fixtures, …) against
 * the JSON Schemas of `packages/rules/schema/v1` (draft 2020-12) plus the
 * extension keywords every platform enforces (SEMANTICS.md §1):
 *
 * - `x-uniqueBy: <pointer>`: array items must differ at that JSON pointer,
 *   site targets compared normalised (`www.`/`m.` dropped, aliases rewritten,
 *   globs lower-cased, the catch-all glob as no path) → `duplicate_key`;
 * - `x-registrableDomain`: two labels after normalisation and not a bare
 *   public suffix → `invalid_domain`;
 * - `x-timeZone`: resolvable by `java.time.ZoneId`, case-sensitively →
 *   `invalid_time_zone`;
 * - documents over 256 KiB of UTF-8 → `too_large`; unparseable text →
 *   `invalid_json`; anything else → `schema`.
 *
 * Pure: the schema texts (file name without `.schema.json` → JSON) and the
 * alias map (alias → canonical domain, from the site profiles) are passed
 * in, so the app can bundle them and tests read them from `packages/rules`.
 * Nothing is fetched: every `$ref` resolves among the given schemas.
 */
class RulesetValidator(
    schemas: Map<String, String>,
    private val aliases: Map<String, String>,
) {
    private val registry: SchemaRegistry
    private val compiled = ConcurrentHashMap<String, Schema>()
    private val schemaNames: Set<String> = schemas.keys

    init {
        val dialect =
            Dialect
                .builder(Draft202012.getInstance())
                .keyword(CustomKeyword(UNIQUE_BY_KEYWORD, ::isUniqueBy))
                .keyword(CustomKeyword(REGISTRABLE_DOMAIN_KEYWORD, ::isRegistrable))
                .keyword(CustomKeyword(TIME_ZONE_KEYWORD, ::isTimeZone))
                .build()
        val config = SchemaRegistryConfig.builder().formatAssertionsEnabled(true).build()
        val byIri = schemas.mapKeys { (name, _) -> schemaIdOf(name) }
        registry =
            SchemaRegistry.withDialect(dialect) { builder ->
                builder.schemas(byIri).schemaRegistryConfig(config)
            }
    }

    /** Validates an already parsed document. */
    fun validate(
        schema: String,
        value: JsonNode,
    ): ValidationResult {
        if (schema !in schemaNames) return ValidationResult.Rejected(RejectionCode.SCHEMA, listOf("unknown_schema: $schema"))
        val compiledSchema = compiled.getOrPut(schema) { registry.getSchema(SchemaLocation.of(schemaIdOf(schema))) }
        val failedKeywords = mutableSetOf<String>()
        val errors: List<Error> =
            compiledSchema.validate(value) { context: ExecutionContext ->
                context.collectorContext.put(FAILED_KEYWORDS, failedKeywords)
            }
        if (errors.isEmpty()) return ValidationResult.Valid
        failedKeywords += errors.mapNotNull { it.keyword }
        val messages = errors.map { "${it.instanceLocation} ${it.keyword}" }
        return ValidationResult.Rejected(codeOf(failedKeywords), messages)
    }

    /** Validates raw text: size limit first, then JSON syntax, then the schema. */
    fun validateDocument(
        schema: String,
        text: String,
    ): ValidationResult {
        if (text.toByteArray(Charsets.UTF_8).size > MAX_DOCUMENT_BYTES) {
            return ValidationResult.Rejected(RejectionCode.TOO_LARGE, listOf("document_too_large"))
        }
        val value =
            try {
                MAPPER.readTree(text) ?: return ValidationResult.Rejected(RejectionCode.INVALID_JSON, listOf("invalid_json"))
            } catch (_: JacksonException) {
                return ValidationResult.Rejected(RejectionCode.INVALID_JSON, listOf("invalid_json"))
            }
        if (value.isMissingNode) return ValidationResult.Rejected(RejectionCode.INVALID_JSON, listOf("invalid_json"))
        return validate(schema, value)
    }

    private fun isUniqueBy(
        pointer: JsonNode,
        instance: JsonNode,
    ): Boolean {
        if (!instance.isArray || !pointer.isTextual) return true
        val keys = instance.map { item -> canonicalJson(canonicalTarget(valueAt(item, pointer.asText()), aliases)) }
        return keys.toSet().size == keys.size
    }

    private fun isRegistrable(
        enabled: JsonNode,
        instance: JsonNode,
    ): Boolean = !instance.isTextual || !enabled.asBoolean() || isRegistrableDomain(instance.asText(), aliases)

    private fun isTimeZone(
        enabled: JsonNode,
        instance: JsonNode,
    ): Boolean = !instance.isTextual || !enabled.asBoolean() || isResolvableTimeZone(instance.asText())

    /** An extension keyword with a predicate over (keyword value, instance); failures are recorded for [codeOf]. */
    private class CustomKeyword(
        keyword: String,
        private val holds: (JsonNode, JsonNode) -> Boolean,
    ) : AbstractKeyword(keyword) {
        private val keywordName: String = keyword

        override fun newValidator(
            schemaLocation: SchemaLocation,
            schemaNode: JsonNode,
            parentSchema: Schema,
            schemaContext: SchemaContext,
        ): KeywordValidator =
            object : BaseKeywordValidator(this, schemaNode, schemaLocation, parentSchema, schemaContext) {
                override fun validate(
                    executionContext: ExecutionContext,
                    node: JsonNode,
                    rootNode: JsonNode,
                    instanceLocation: NodePath,
                ) {
                    if (holds(schemaNode, node)) return
                    // Recorded even inside a failing `oneOf` branch, whose own errors the parent folds away
                    // (ajv with `allErrors` reports them too, so both platforms pick the same code).
                    executionContext.collectorContext.get<MutableSet<String>>(FAILED_KEYWORDS)?.add(keywordName)
                    executionContext.addError(
                        Error
                            .builder()
                            .keyword(keywordName)
                            .instanceLocation(instanceLocation)
                            .evaluationPath(executionContext.evaluationPath)
                            .schemaLocation(schemaLocation)
                            .message("$instanceLocation: $keywordName")
                            .build(),
                    )
                }
            }
    }

    companion object {
        /** Hard limit for any rules document (rule set, profile, pack, fixture): 256 KiB of UTF-8. */
        const val MAX_DOCUMENT_BYTES = 256 * 1024

        /** Base URI of every v1 schema `$id`. Identifiers only: nothing is fetched from it. */
        const val SCHEMA_BASE_URI = "https://monkifocus.dev/schema/rules/v1/"

        const val UNIQUE_BY_KEYWORD = "x-uniqueBy"
        const val REGISTRABLE_DOMAIN_KEYWORD = "x-registrableDomain"
        const val TIME_ZONE_KEYWORD = "x-timeZone"

        private const val FAILED_KEYWORDS = "monki.failedKeywords"

        private val MAPPER: ObjectMapper = ObjectMapper().enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)

        fun schemaIdOf(name: String): String = "$SCHEMA_BASE_URI$name.schema.json"

        private fun codeOf(keywords: Set<String>): RejectionCode =
            when {
                UNIQUE_BY_KEYWORD in keywords -> RejectionCode.DUPLICATE_KEY
                REGISTRABLE_DOMAIN_KEYWORD in keywords -> RejectionCode.INVALID_DOMAIN
                TIME_ZONE_KEYWORD in keywords -> RejectionCode.INVALID_TIME_ZONE
                else -> RejectionCode.SCHEMA
            }

        private fun valueAt(
            item: JsonNode,
            pointer: String,
        ): JsonNode? {
            var current: JsonNode? = item
            for (segment in pointer.split('/').drop(1)) {
                if (current == null || !current.isObject) return null
                current = current.get(segment)
            }
            return current
        }

        /** Key-order independent JSON text of a value; a missing value has its own key. */
        private fun canonicalJson(value: JsonNode?): String =
            when {
                value == null -> {
                    "undefined"
                }

                value.isArray -> {
                    value.joinToString(",", "[", "]") { canonicalJson(it) }
                }

                value.isObject -> {
                    value
                        .properties()
                        .sortedBy { it.key }
                        .joinToString(",", "{", "}") { (key, child) -> MAPPER.writeValueAsString(key) + ":" + canonicalJson(child) }
                }

                else -> {
                    MAPPER.writeValueAsString(value)
                }
            }
    }
}
