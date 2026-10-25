// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.fixtures

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/** SEMANTICS.md §12: a runner per kind (analytics included), loud failures, nothing skipped. */
class RunnerCoverageTest {
    @get:Rule
    val temporary = TemporaryFolder()

    @Test
    fun runs_every_fixture_kind_the_rules_package_declares() {
        val declared = FixtureLoader.declaredKinds.filter { it !in RunnerKinds.RUN_ELSEWHERE }

        assertEquals(declared.sorted(), RunnerKinds.RUN_HERE.sorted())
    }

    @Test
    fun runs_every_fixture_directory_that_exists() {
        val directories =
            RulesPackage
                .directory("fixtures")
                .listFiles { file -> file.isDirectory }!!
                .map { it.name }
                .filter { it !in RunnerKinds.RUN_ELSEWHERE && it !in RunnerKinds.NOT_KINDS }

        assertEquals(directories.sorted(), RunnerKinds.RUN_HERE.sorted())
    }

    @Test
    fun the_analytics_kind_has_a_runner_here() {
        assertTrue(RunnerKinds.RUN_HERE.contains("activity"))
        assertEquals(listOf("unlock-token"), RunnerKinds.RUN_ELSEWHERE)
    }

    @Test
    fun all_fixtures_validate_against_schema() {
        val loaded = RunnerKinds.RUN_HERE.associateWith { FixtureLoader.load(it).size }

        assertTrue("every kind has fixtures: $loaded", loaded.values.all { it > 0 })
    }

    @Test
    fun fixture_ids_are_unique() {
        val ids = RunnerKinds.RUN_HERE.flatMap { kind -> FixtureLoader.load(kind).map { it.id } }

        assertEquals(ids.size, ids.toSet().size)
    }

    @Test
    fun unknown_fixture_kind_fails_loudly() {
        assertThrows(IllegalArgumentException::class.java) { FixtureLoader.load("mystery") }
    }

    @Test
    fun a_misfiled_or_invalid_fixture_fails_loudly() {
        val source = RulesPackage.directory("fixtures/schedule").listFiles()!!.first { it.extension == "json" }
        val misfiled = File(temporary.newFolder("escalation"), source.name).apply { writeText(source.readText()) }
        assertThrows(IllegalArgumentException::class.java) { FixtureLoader.load("escalation", root = misfiled.parentFile.parentFile) }

        val renamed = File(temporary.newFolder("other", "schedule"), "wrong_name.json").apply { writeText(source.readText()) }
        assertThrows(IllegalArgumentException::class.java) { FixtureLoader.load("schedule", root = renamed.parentFile.parentFile) }

        val broken = File(temporary.newFolder("broken", "schedule"), source.name).apply { writeText("{\"id\": 1}") }
        assertThrows(IllegalArgumentException::class.java) { FixtureLoader.load("schedule", root = broken.parentFile.parentFile) }
    }
}
