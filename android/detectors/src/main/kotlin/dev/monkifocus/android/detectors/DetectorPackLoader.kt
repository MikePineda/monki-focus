// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import dev.monkifocus.android.core.domain.rules.RulesJson
import dev.monkifocus.android.core.domain.signing.SignatureVerifier
import dev.monkifocus.android.core.domain.validation.RejectionCode
import dev.monkifocus.android.core.domain.validation.RulesetValidator
import dev.monkifocus.android.core.domain.validation.ValidationResult
import kotlinx.serialization.SerializationException
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.CodingErrorAction

/**
 * Loads detector packs (plan §1.6, docs/threat-model.md "Reglas"). A
 * downloaded pack is accepted only after, in this order:
 *
 * 1. size: at most [RulesetValidator.MAX_DOCUMENT_BYTES];
 * 2. signature: Ed25519 over the exact file bytes, checked by [verifier]
 *    with its pinned public key, before anything is parsed;
 * 3. strict UTF-8, then `detector-pack.schema.json` through [validator]
 *    (unknown fields, scripts and regex-like keys are refused), then a strict
 *    decode;
 * 4. `minSchemaVersion` supported by this build;
 * 5. pack id and every package inside the compiled [allowlist];
 * 6. `packVersion` strictly newer than the installed pack of the same id
 *    (monotonic: no rollback, no replay of the same version).
 *
 * Packs are data only: nothing in them is executed. A rejection leaves the
 * installed pack active. The pack bundled in the APK is trusted as part of
 * the signed app (no detached signature) but passes every other check, and
 * it is the fallback whenever no newer downloaded pack is accepted.
 */
class DetectorPackLoader(
    private val validator: RulesetValidator,
    private val verifier: SignatureVerifier,
    private val allowlist: PackageAllowlist = PackageAllowlist.COMPILED,
    private val supportedSchemaVersion: Int = SUPPORTED_SCHEMA_VERSION,
) {
    /** A pack shipped inside the APK. */
    fun loadBundled(bytes: ByteArray): PackLoadResult = decode(bytes)

    /** A pack fetched at runtime, with its detached signature and the pack it would replace. */
    fun loadDownloaded(
        bytes: ByteArray,
        signature: ByteArray,
        installed: DetectorPack,
    ): PackLoadResult {
        if (bytes.size > RulesetValidator.MAX_DOCUMENT_BYTES) return rejected(PackRejection.TOO_LARGE)
        if (!verifySafely(bytes, signature)) return rejected(PackRejection.INVALID_SIGNATURE)
        val result = decode(bytes)
        if (result !is PackLoadResult.Accepted) return result
        val pack = result.pack
        return when {
            pack.packId != installed.packId -> rejected(PackRejection.PACK_ID_MISMATCH)
            pack.version <= installed.version -> rejected(PackRejection.NOT_NEWER)
            else -> result
        }
    }

    /** The pack to classify with: the downloaded one when it is newer than the bundled one, else the bundled fallback. */
    fun active(
        bundled: DetectorPack,
        downloaded: DetectorPack?,
    ): DetectorPack =
        downloaded?.takeIf { it.packId == bundled.packId && it.version > bundled.version && allowlist.permits(it.packId, it.packages) }
            ?: bundled

    private fun decode(bytes: ByteArray): PackLoadResult {
        if (bytes.size > RulesetValidator.MAX_DOCUMENT_BYTES) return rejected(PackRejection.TOO_LARGE)
        val text = strictUtf8(bytes) ?: return rejected(PackRejection.INVALID_JSON)
        when (val validation = validator.validateDocument(SCHEMA_NAME, text)) {
            is ValidationResult.Valid -> Unit
            is ValidationResult.Rejected -> return rejected(rejectionOf(validation.code))
        }
        val pack =
            try {
                RulesJson.decodeFromString(DetectorPack.serializer(), text)
            } catch (_: SerializationException) {
                return rejected(PackRejection.SCHEMA)
            } catch (_: IllegalArgumentException) {
                return rejected(PackRejection.SCHEMA)
            }
        return when {
            pack.minSchemaVersion > supportedSchemaVersion -> rejected(PackRejection.UNSUPPORTED_SCHEMA)
            !allowlist.permits(pack.packId, pack.packages) -> rejected(PackRejection.PACKAGE_NOT_ALLOWED)
            else -> PackLoadResult.Accepted(pack)
        }
    }

    // A verifier must not throw, but a hostile signature must never take the loader down either.
    private fun verifySafely(
        bytes: ByteArray,
        signature: ByteArray,
    ): Boolean =
        try {
            signature.size == SIGNATURE_BYTES && verifier.verify(bytes, signature)
        } catch (_: RuntimeException) {
            false
        }

    private fun strictUtf8(bytes: ByteArray): String? =
        try {
            Charsets.UTF_8
                .newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes))
                .toString()
        } catch (_: CharacterCodingException) {
            null
        }

    private fun rejectionOf(code: RejectionCode): PackRejection =
        when (code) {
            RejectionCode.TOO_LARGE -> PackRejection.TOO_LARGE
            RejectionCode.INVALID_JSON -> PackRejection.INVALID_JSON
            else -> PackRejection.SCHEMA
        }

    private fun rejected(reason: PackRejection) = PackLoadResult.Rejected(reason)

    companion object {
        /** The highest detector-pack schema version this build understands. */
        const val SUPPORTED_SCHEMA_VERSION = 1

        /** Ed25519 detached signatures are 64 bytes. */
        const val SIGNATURE_BYTES = 64

        private const val SCHEMA_NAME = "detector-pack"
    }
}
