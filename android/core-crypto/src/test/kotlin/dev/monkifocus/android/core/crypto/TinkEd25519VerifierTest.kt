// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.crypto

import com.google.crypto.tink.subtle.Ed25519Sign
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The real verifier behind detector-pack signatures: Ed25519 over the exact
 * bytes of a bundled pack file. The key pair is generated per test run; the
 * project's `rules-signing` private key never leaves its offline machine.
 */
class TinkEd25519VerifierTest {
    private val packBytes: ByteArray =
        requireNotNull(javaClass.getResourceAsStream("/detectors/android/instagram.pack.json")) { "pack not on the test classpath" }
            .use { it.readBytes() }
    private val keyPair = Ed25519Sign.KeyPair.newKeyPair()
    private val signature = Ed25519Sign(keyPair.privateKey).sign(packBytes)
    private val verifier = TinkEd25519Verifier(keyPair.publicKey)

    @Test
    fun pack_bytes_signed_with_the_pinned_key_verify() {
        assertTrue(verifier.verify(packBytes, signature))
    }

    @Test
    fun a_single_changed_byte_of_the_pack_fails() {
        val tampered = packBytes.copyOf().also { it[it.size - 2] = (it[it.size - 2].toInt() xor 0x20).toByte() }

        assertFalse(verifier.verify(tampered, signature))
    }

    @Test
    fun reformatting_the_pack_fails_because_the_signature_covers_the_exact_bytes() {
        val reformatted = (String(packBytes, Charsets.UTF_8).trimEnd() + "\n\n").toByteArray(Charsets.UTF_8)

        assertFalse(verifier.verify(reformatted, signature))
    }

    @Test
    fun a_signature_from_another_key_fails() {
        val otherKey = Ed25519Sign.KeyPair.newKeyPair()
        val foreign = Ed25519Sign(otherKey.privateKey).sign(packBytes)

        assertFalse(verifier.verify(packBytes, foreign))
    }

    @Test
    fun a_malformed_signature_is_false_not_an_exception() {
        assertFalse(verifier.verify(packBytes, ByteArray(3)))
    }

    @Test
    fun a_public_key_of_the_wrong_size_is_refused() {
        assertThrows(IllegalArgumentException::class.java) { TinkEd25519Verifier(ByteArray(31)) }
    }
}
