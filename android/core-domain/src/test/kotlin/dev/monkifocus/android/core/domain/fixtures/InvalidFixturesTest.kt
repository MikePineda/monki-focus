// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.fixtures

import dev.monkifocus.android.core.domain.rules.RulesJson
import dev.monkifocus.android.core.domain.validation.ValidationResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/** SEMANTICS.md §1, §12: every `invalid` fixture is rejected by the Kotlin validator with its code. */
@RunWith(Parameterized::class)
class InvalidFixturesTest(
    @Suppress("unused") private val id: String,
    private val fixture: Fixture,
) {
    @Test
    fun is_rejected_with_its_code() {
        val case = RulesJson.decodeFromString(InvalidFixture.serializer(), fixture.text)
        assertTrue(case.then.rejected)

        val result = RulesPackage.validator.validateDocument(case.schema, case.document.toString())

        assertTrue("$result", result is ValidationResult.Rejected)
        assertEquals(case.then.code, (result as ValidationResult.Rejected).code.code)
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun fixtures(): List<Array<Any>> = FixtureLoader.parameters("invalid")
    }
}
