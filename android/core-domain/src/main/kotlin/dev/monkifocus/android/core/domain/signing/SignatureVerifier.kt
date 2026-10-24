// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.signing

/**
 * Port: checks a detached signature over the exact bytes of a signed document
 * (detector packs now, policy bundles later). The implementation pins its
 * public key at construction (`TinkEd25519Verifier` in `:core-crypto`), so a
 * caller can never choose the key a document is checked against.
 *
 * Returns false for any malformed or wrong signature; it never throws.
 */
fun interface SignatureVerifier {
    fun verify(
        message: ByteArray,
        signature: ByteArray,
    ): Boolean
}
