// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.crypto

import com.google.crypto.tink.subtle.Ed25519Verify
import com.google.crypto.tink.subtle.Hex
import org.junit.Assert.assertThrows
import org.junit.Test
import java.security.GeneralSecurityException

/**
 * Pins the primitive the detector-pack and unlock-token verifiers build on:
 * Tink's offline Ed25519 verification, checked against RFC 8032 §7.1.
 */
class TinkEd25519Test {
    private val publicKey = Hex.decode("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a")
    private val message = ByteArray(0)
    private val signature =
        Hex.decode(
            "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
        )

    @Test
    fun rfc8032_test_vector_verifies_offline() {
        Ed25519Verify(publicKey).verify(signature, message)
    }

    @Test
    fun tampered_signature_is_rejected() {
        val tampered = signature.copyOf().also { it[0] = (it[0].toInt() xor 0x01).toByte() }

        assertThrows(GeneralSecurityException::class.java) { Ed25519Verify(publicKey).verify(tampered, message) }
    }
}
