// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.crypto

import com.google.crypto.tink.subtle.Ed25519Verify
import dev.monkifocus.android.core.domain.signing.SignatureVerifier
import java.security.GeneralSecurityException

/**
 * Offline Ed25519 verification (RFC 8032) with Tink under the project's
 * strict policy ([Ed25519StrictPolicy]), against one public key pinned at
 * construction: the project's `rules-signing` key compiled into the app for
 * detector packs.
 *
 * The pinned key must be a canonical point of the prime-order subgroup
 * (construction fails otherwise); a signature must have an acceptable R and
 * S < L before Tink checks the equation. Anything else is `false`.
 */
class TinkEd25519Verifier(
    publicKey: ByteArray,
) : SignatureVerifier {
    private val verifier: Ed25519Verify

    init {
        require(publicKey.size == PUBLIC_KEY_BYTES) { "an Ed25519 public key is $PUBLIC_KEY_BYTES bytes" }
        require(Ed25519StrictPolicy.isAcceptablePoint(publicKey)) { "the pinned key is not a canonical prime-order point" }
        verifier = Ed25519Verify(publicKey.copyOf())
    }

    override fun verify(
        message: ByteArray,
        signature: ByteArray,
    ): Boolean {
        if (!Ed25519StrictPolicy.isAcceptableSignature(signature)) return false
        return try {
            verifier.verify(signature, message)
            true
        } catch (_: GeneralSecurityException) {
            false
        }
    }

    companion object {
        const val PUBLIC_KEY_BYTES = 32
    }
}
