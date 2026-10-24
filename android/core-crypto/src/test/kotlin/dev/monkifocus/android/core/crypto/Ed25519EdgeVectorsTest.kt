// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.crypto

import com.google.crypto.tink.subtle.Hex
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The vendored Wycheproof EddsaVerify and "Taming the many EdDSAs"
 * (speccheck) suites of `packages/protocol/fixtures/ed25519-edge`, run
 * through [TinkEd25519Verifier] with the protocol's strict verdicts
 * (`verdicts.json`): Wycheproof valid → accept, invalid and acceptable →
 * reject; every speccheck case → reject, for the listed reasons.
 */
class Ed25519EdgeVectorsTest {
    private fun json(name: String): JsonElement =
        Json.parseToJsonElement(
            requireNotNull(javaClass.getResource("/protocol/fixtures/ed25519-edge/$name")) { "$name not on the test classpath" }.readText(),
        )

    private val verdicts = json("verdicts.json").jsonObject

    /** What the app does: pin the key (refused keys reject everything), then verify. */
    private fun verdict(
        publicKeyHex: String,
        messageHex: String,
        signatureHex: String,
    ): String {
        val verifier =
            try {
                TinkEd25519Verifier(Hex.decode(publicKeyHex))
            } catch (_: IllegalArgumentException) {
                return "reject"
            }
        return if (verifier.verify(Hex.decode(messageHex), Hex.decode(signatureHex))) "accept" else "reject"
    }

    @Test
    fun wycheproof_eddsa_verify_matches_the_strict_verdicts() {
        val policy = verdicts.getValue("wycheproof").jsonObject
        val mismatches = mutableListOf<String>()
        var count = 0
        for (group in json("wycheproof-ed25519_test.json").jsonObject.getValue("testGroups").jsonArray) {
            val pk =
                group.jsonObject
                    .getValue("publicKey")
                    .jsonObject
                    .getValue("pk")
                    .jsonPrimitive.content
            for (test in group.jsonObject.getValue("tests").jsonArray) {
                val case = test.jsonObject
                count++
                val expected = policy.getValue(case.getValue("result").jsonPrimitive.content).jsonPrimitive.content
                val actual = verdict(pk, case.getValue("msg").jsonPrimitive.content, case.getValue("sig").jsonPrimitive.content)
                if (actual != expected) mismatches += "tc ${case.getValue("tcId").jsonPrimitive.int}: $actual, expected $expected"
            }
        }

        assertEquals(210, count)
        assertEquals(emptyList<String>(), mismatches)
    }

    @Test
    fun speccheck_cases_match_the_strict_verdicts_and_reasons() {
        val cases = json("speccheck-cases.json") as JsonArray
        val expected = verdicts.getValue("speccheck").jsonArray.map { it.jsonObject }

        assertEquals(12, cases.size)
        for (entry in expected) {
            val index = entry.getValue("index").jsonPrimitive.int
            val case = cases[index].jsonObject
            val pk = Hex.decode(case.getValue("pub_key").jsonPrimitive.content)
            val signature = Hex.decode(case.getValue("signature").jsonPrimitive.content)
            val reasons =
                listOfNotNull(
                    "A".takeUnless { Ed25519StrictPolicy.isAcceptablePoint(pk) },
                    "R".takeUnless { Ed25519StrictPolicy.isAcceptablePoint(signature.copyOfRange(0, 32)) },
                    "S".takeUnless { Ed25519StrictPolicy.isCanonicalScalar(signature) },
                )

            assertEquals(
                "speccheck $index",
                entry.getValue("verdict").jsonPrimitive.content,
                verdict(
                    case.getValue("pub_key").jsonPrimitive.content,
                    case.getValue("message").jsonPrimitive.content,
                    case.getValue("signature").jsonPrimitive.content,
                ),
            )
            assertEquals("speccheck $index reasons", entry.getValue("reasons").jsonArray.map { it.jsonPrimitive.content }, reasons)
        }
    }

    @Test
    fun small_order_and_non_canonical_keys_cannot_be_pinned() {
        for (hex in SMALL_ORDER_AND_NON_CANONICAL) {
            assertEquals(hex, false, Ed25519StrictPolicy.isAcceptablePoint(Hex.decode(hex)))
        }
    }

    @Test
    fun a_signature_with_s_at_or_above_l_is_rejected_before_tink() {
        val l = "edd3f55c1a631258d69cf7a2def9de1400000000000000000000000000000010"
        val signature = Hex.decode("00".repeat(32) + l)

        assertEquals(false, Ed25519StrictPolicy.isCanonicalScalar(signature))
    }

    private companion object {
        val SMALL_ORDER_AND_NON_CANONICAL =
            listOf(
                "0000000000000000000000000000000000000000000000000000000000000000",
                "0000000000000000000000000000000000000000000000000000000000000080",
                "0100000000000000000000000000000000000000000000000000000000000000",
                "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
                "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a",
                "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa",
                // y = p (non-canonical encoding of y = 0)
                "edffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
            )
    }
}
