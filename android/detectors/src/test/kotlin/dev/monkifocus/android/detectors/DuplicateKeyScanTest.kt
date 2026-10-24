// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import dev.monkifocus.android.detectors.DuplicateKeyScan.Outcome
import org.junit.Assert.assertEquals
import org.junit.Test

class DuplicateKeyScanTest {
    @Test
    fun a_pack_has_unique_keys() {
        assertEquals(Outcome.UNIQUE, DuplicateKeyScan.scan(String(RulesResources.packBytes("instagram"), Charsets.UTF_8)))
    }

    @Test
    fun the_same_key_twice_in_one_object_is_a_duplicate() {
        assertEquals(Outcome.DUPLICATE, DuplicateKeyScan.scan("""{"packVersion": "2026.10.26.1", "packVersion": "2026.01.01.1"}"""))
        assertEquals(Outcome.DUPLICATE, DuplicateKeyScan.scan("""{"a": [{"viewId": "x", "viewId": "y"}]}"""))
    }

    @Test
    fun escaped_keys_are_compared_unescaped() {
        assertEquals(Outcome.DUPLICATE, DuplicateKeyScan.scan("""{"a": 1, "a": 2}"""))
    }

    @Test
    fun the_same_key_in_sibling_objects_is_fine() {
        assertEquals(Outcome.UNIQUE, DuplicateKeyScan.scan("""[{"a": 1}, {"a": 2}, {"b": {"a": 3}}]"""))
    }

    @Test
    fun malformed_or_too_deep_json_is_malformed() {
        assertEquals(Outcome.MALFORMED, DuplicateKeyScan.scan("""{"a": 1,}"""))
        assertEquals(Outcome.MALFORMED, DuplicateKeyScan.scan("""{"a": 01}"""))
        assertEquals(Outcome.MALFORMED, DuplicateKeyScan.scan("""{"a": "\x"}"""))
        assertEquals(Outcome.MALFORMED, DuplicateKeyScan.scan("""{"a": 1} trailing"""))
        assertEquals(Outcome.MALFORMED, DuplicateKeyScan.scan("[".repeat(100) + "]".repeat(100)))
    }
}
