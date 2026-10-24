// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain

import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * `packages/rules` is wired as a test resources dir of this module, so the
 * Kotlin runners read the same fixtures as the TypeScript ones.
 */
class SharedRulesFixturesTest {
    private val rulesDir = File(requireNotNull(System.getProperty("monki.rulesDir")) { "monki.rulesDir is not set" })

    @Test
    fun shared_rules_package_is_on_the_test_classpath() {
        assertTrue("$rulesDir must exist", rulesDir.isDirectory)
        assertNotNull(
            "packages/rules/README.md must be readable as a test resource",
            javaClass.getResource("/README.md"),
        )
    }

    @Test
    fun shared_rules_package_ships_schema_v1() {
        // Enabled with -Pmonki.rules.expectSchemaV1=true once work package 2.1 lands the schema.
        assumeTrue(System.getProperty("monki.rules.expectSchemaV1").toBoolean())

        assertTrue("schema/v1 must exist in $rulesDir", File(rulesDir, "schema/v1").isDirectory)
        assertNotNull("schema/v1 must be on the test classpath", javaClass.getResource("/schema/v1"))
    }
}
