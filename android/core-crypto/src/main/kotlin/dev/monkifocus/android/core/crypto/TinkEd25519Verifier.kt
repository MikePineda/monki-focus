// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.crypto

import com.google.crypto.tink.subtle.Ed25519Verify
import dev.monkifocus.android.core.domain.signing.SignatureVerifier
import java.security.GeneralSecurityException

/**
 * Offline Ed25519 verification (RFC 8032) with Tink, against one public key
 * pinned at construction: the project's `rules-signing` key compiled into
 * the app for detector packs. Any malformed or wrong signature is `false`.
 */
class TinkEd25519Verifier(
    publicKey: ByteArray,
) : SignatureVerifier {
    private val verifier: Ed25519Verify

    init {
        require(publicKey.size == PUBLIC_KEY_BYTES) { "an Ed25519 public key is $PUBLIC_KEY_BYTES bytes" }
        verifier = Ed25519Verify(publicKey.copyOf())
    }

    override fun verify(
        message: ByteArray,
        signature: ByteArray,
    ): Boolean =
        try {
            verifier.verify(signature, message)
            true
        } catch (_: GeneralSecurityException) {
            false
        }

    companion object {
        const val PUBLIC_KEY_BYTES = 32
    }
}
