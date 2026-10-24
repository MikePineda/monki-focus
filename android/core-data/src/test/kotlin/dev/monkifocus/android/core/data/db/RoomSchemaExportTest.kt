// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * The exported schema of the current version is committed next to the module
 * (`room.schemaDirectory`), so every later version has a reviewed baseline
 * for its additive migration. Plain JVM: it reads the committed files.
 */
class RoomSchemaExportTest {
    private val moduleDir = File(requireNotNull(System.getProperty("monki.projectDir")) { "monki.projectDir is not set" })
    private val schemaFile = File(moduleDir, "schemas/${MonkiDatabase::class.java.name}/${MonkiDatabase.VERSION}.json")
    private val database: JsonObject by lazy {
        Json
            .parseToJsonElement(schemaFile.readText())
            .jsonObject
            .getValue("database")
            .jsonObject
    }

    private fun entities(): List<JsonObject> = database.getValue("entities").jsonArray.map { it.jsonObject }

    @Test
    fun room_schema_is_exported() {
        assertTrue("Missing ${schemaFile.relativeTo(moduleDir)}: build once to export it", schemaFile.isFile)
        assertEquals(MonkiDatabase.VERSION, database.getValue("version").jsonPrimitive.int)

        val tables = entities().map { it.getValue("tableName").jsonPrimitive.content }
        assertEquals(MonkiTables.ALL.sorted(), tables.sorted())
        assertEquals(entityCountInDatabaseSource(), tables.size)
    }

    @Test
    fun aw_event_has_its_natural_key_index() {
        val awEvent = entities().single { it.getValue("tableName").jsonPrimitive.content == MonkiTables.AW_EVENT }
        val unique =
            awEvent
                .getValue("indices")
                .jsonArray
                .map { it.jsonObject }
                .filter { it.getValue("unique").jsonPrimitive.boolean }

        assertEquals(
            listOf(listOf("bucket_id", "timestamp_ms", "data_hash")),
            unique.map { index -> index.getValue("columnNames").jsonArray.map { it.jsonPrimitive.content } },
        )
    }

    @Test
    fun every_schema_version_up_to_the_current_one_is_committed() {
        val versions =
            schemaFile.parentFile
                .listFiles()
                .orEmpty()
                .map { it.nameWithoutExtension.toInt() }
                .sorted()

        assertEquals((1..MonkiDatabase.VERSION).toList(), versions)
    }

    /** `@Database(entities = [...])` is not visible at runtime, so count the classes in its source. */
    private fun entityCountInDatabaseSource(): Int {
        val source = File(moduleDir, "src/main/kotlin/dev/monkifocus/android/core/data/db/MonkiDatabase.kt").readText()
        val list = source.substringAfter("entities = [").substringBefore("]")
        return Regex("""\w+::class""").findAll(list).count()
    }
}
