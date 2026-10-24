// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.fixtures

import dev.monkifocus.android.core.domain.engine.normalizeUrl
import dev.monkifocus.android.core.domain.rules.RulesJson
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/** SEMANTICS.md §2: every `url-normalize` fixture. */
@RunWith(Parameterized::class)
class UrlNormalizeFixturesTest(
    @Suppress("unused") private val id: String,
    private val fixture: Fixture,
) {
    @Test
    fun normalises_as_specified() {
        val case = RulesJson.decodeFromString(UrlNormalizeFixture.serializer(), fixture.text)

        assertEquals(case.then, normalizeUrl(case.given.urlText, RulesPackage.catalog))
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun fixtures(): List<Array<Any>> = FixtureLoader.parameters("url-normalize")
    }
}
